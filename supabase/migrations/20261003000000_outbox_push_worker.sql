-- Push from the outbox (task 3.3, plan §4.4, ADR-009, ADR-010).
--
-- The item RPCs queue `push` jobs in public.outbox. The outbox-worker Edge
-- Function sends them. It is called:
--   - by a trigger on outbox insert (through pg_net), so a push goes out within
--     seconds of the change, and
--   - by pg_cron every minute, to catch up and retry.
--
-- The worker claims jobs with claim_outbox_jobs() (for update skip locked, so
-- the trigger's call and the cron's call never send the same job twice) and
-- reports each result with finish_outbox_job().
--
-- No secrets live here. The function URL and the shared secret the worker
-- checks are read from Supabase Vault (`outbox_worker_url`,
-- `outbox_worker_secret`; set once by hand, plan §8.3). Until both are set,
-- the trigger and the cron do nothing, and jobs wait as `pending`.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Job statuses: pending → sending (claimed) → done, or back to pending with a
-- later run_at to retry, or failed after 5 attempts.
--
-- While a job is `sending`, run_at is its lease: if the worker dies before
-- finishing, the job can be claimed again once run_at has passed.
-- ---------------------------------------------------------------------------

alter table public.outbox drop constraint outbox_status_check;
alter table public.outbox add constraint outbox_status_check
  check (status in ('pending', 'sending', 'done', 'failed'));

create index outbox_push_due_idx on public.outbox (run_at)
  where kind = 'push' and status in ('pending', 'sending');

-- The job that wrote each notification, so a retried job never writes a
-- second in-app row.
alter table public.notifications
  add column outbox_id bigint unique references public.outbox (id) on delete set null;

-- Claims up to max_jobs due push jobs for the worker: marks them `sending`,
-- counts the attempt and leases them for 2 minutes. Rows another call has
-- locked are skipped, never waited for. Other job kinds (reminder, overdue,
-- weekly_summary, geocode) are left alone for task 4.5. A job whose lease ran
-- out on its 5th attempt is marked failed instead of claimed.
create function public.claim_outbox_jobs(max_jobs integer default 10)
returns setof public.outbox
language plpgsql security definer set search_path = ''
as $$
begin
  update public.outbox o
  set status = 'failed',
      last_error = coalesce(o.last_error, 'worker_did_not_finish')
  where o.id in (
    select x.id from public.outbox x
    where x.kind = 'push' and x.status = 'sending' and x.run_at <= now() and x.attempts >= 5
    for update skip locked
  );

  return query
  with due as (
    select x.id from public.outbox x
    where x.kind = 'push'
      and x.status in ('pending', 'sending')
      and x.run_at <= now()
      and x.attempts < 5
    order by x.run_at, x.id
    limit greatest(coalesce(claim_outbox_jobs.max_jobs, 0), 0)
    for update skip locked
  )
  update public.outbox o
  set status = 'sending',
      attempts = o.attempts + 1,
      run_at = now() + interval '2 minutes'
  from due
  where o.id = due.id
  returning o.*;
end $$;

-- Records the result of a claimed job. With no failure the job is done.
-- Otherwise it is retried after 1, 5, 15, then 60 minutes, and is failed once
-- it has had 5 attempts. `attempt` is the job's attempts as claimed: the
-- update does nothing unless the job is still `sending` on that attempt, so a
-- worker whose lease ran out can't overwrite the result of the one that
-- claimed the job again.
create function public.finish_outbox_job(job_id bigint, attempt integer, failure text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.outbox o
  set status = case
        when finish_outbox_job.failure is null then 'done'
        when o.attempts >= 5 then 'failed'
        else 'pending'
      end,
      last_error = coalesce(left(finish_outbox_job.failure, 1000), o.last_error),
      run_at = case
        when finish_outbox_job.failure is null or o.attempts >= 5 then now()
        else now() + case o.attempts
          when 1 then interval '1 minute'
          when 2 then interval '5 minutes'
          when 3 then interval '15 minutes'
          else interval '60 minutes'
        end
      end
  where o.id = finish_outbox_job.job_id
    and o.attempts = finish_outbox_job.attempt
    and o.status = 'sending';
end $$;

-- ---------------------------------------------------------------------------
-- Calling the worker
-- ---------------------------------------------------------------------------

-- Asks the outbox-worker Edge Function to run, through pg_net. The request is
-- queued and only sent once the calling transaction commits, so the worker
-- sees the new jobs. Never raises: a missing Vault value or a pg_net problem
-- is logged and the jobs wait for the next call.
create function public.invoke_outbox_worker()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s where s.name = 'outbox_worker_url';
  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s where s.name = 'outbox_worker_secret';

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise log 'outbox-worker not called: set outbox_worker_url and outbox_worker_secret in Vault (plan §8.3)';
    return null;
  end if;

  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-outbox-secret', v_secret
    ),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'outbox-worker not called: %', sqlerrm;
  return null;
end $$;

-- The "database webhook": after any insert that adds a push job.
create function public.outbox_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from new_rows r where r.kind = 'push') then
    perform public.invoke_outbox_worker();
  end if;
  return null;
end $$;

create trigger outbox_call_worker
  after insert on public.outbox
  referencing new table as new_rows
  for each statement
  execute function public.outbox_after_insert();

-- The cron's catch-up: calls the worker only when a push job is due (a retry,
-- an expired lease, or one the trigger's call missed).
create function public.outbox_catch_up()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.outbox o
    where o.kind = 'push' and o.status in ('pending', 'sending') and o.run_at <= now()
  ) then
    perform public.invoke_outbox_worker();
  end if;
end $$;

-- Re-running cron.schedule with the same name replaces the job.
select cron.schedule('outbox-worker', '* * * * *', 'select public.outbox_catch_up()');

-- ---------------------------------------------------------------------------
-- Who can call what: only the worker (service role) claims and finishes jobs.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.claim_outbox_jobs(integer),
  public.finish_outbox_job(bigint, integer, text),
  public.invoke_outbox_worker(),
  public.outbox_after_insert(),
  public.outbox_catch_up()
from public, anon, authenticated, service_role;

grant execute on function
  public.claim_outbox_jobs(integer),
  public.finish_outbox_job(bigint, integer, text)
to service_role;
