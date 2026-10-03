-- Task 4.5b: reminders and overdue alerts (plan §4.4, ADR-010, PRD US 11.2,
-- 11.3, 11.5).
--
-- Two scheduled outbox job kinds, both written by a trigger on items, so every
-- RPC that changes an item (create_item, accept_assignment, claim, assign,
-- update_item, accept_coverage, cancel_coverage, complete_item, …) and any
-- future bulk insert (recurrence) queues them the same way:
--
--   reminder  {item_id, recipient_id, starts_at}
--     Whenever an item becomes Assigned, its owner changes, or an Assigned
--     item's time changes. Runs at reminder_run_at(): appointments 2 hours
--     before; tasks at 9 am on the due day in the circle's time zone, or 2
--     hours before if they're due before 11 am. Skipped if that has passed.
--
--   overdue   {item_id, starts_at}
--     For every open item, at overdue_run_at(): its due time (starts_at), or
--     9 am the next morning for a task with no time. Queued again when the
--     time changes or the item reopens. Skipped if that has passed.
--     When it runs, expand_overdue_job() re-checks the item and fans it out
--     into one overdue job per person to tell, {item_id, starts_at,
--     recipient_id}: the owner (or the proposed assignee if not yet accepted)
--     and every admin. It logs an `overdue_alerted` history row {starts_at,
--     told: [user ids]} so item detail can say who was told.
--
-- Queuing a new job of either kind for an item supersedes its pending ones
-- (status done, last_error 'superseded'), so moving a time away and back never
-- sends twice. The worker still re-checks each job at send time and drops it
-- if the item is no longer Assigned (reminder) or open (overdue), the owner
-- changed, or starts_at no longer matches the payload.
--
-- Payloads hold IDs and the due time only, never titles or notes (ADR-010).

-- ---------------------------------------------------------------------------
-- When a reminder runs
-- ---------------------------------------------------------------------------

-- Appointments: 2 hours before. Tasks: 9 am on the due day in the circle's
-- time zone, or 2 hours before if the task is due before 11 am.
create function public.reminder_run_at(kind text, starts_at timestamptz, time_zone text)
returns timestamptz
language sql stable set search_path = ''
as $$
  select case
    when reminder_run_at.kind = 'task'
         and (reminder_run_at.starts_at at time zone reminder_run_at.time_zone)::time >= time '11:00'
      then (date_trunc('day', reminder_run_at.starts_at at time zone reminder_run_at.time_zone)
            + interval '9 hours') at time zone reminder_run_at.time_zone
    else reminder_run_at.starts_at - interval '2 hours'
  end
$$;

-- When an overdue alert runs: at the due time, except for a task with no time
-- (stored at 23:59 in the circle's time zone, meaning "by the end of the
-- day"), which is alerted at 9 am the next morning rather than at midnight.
create function public.overdue_run_at(kind text, starts_at timestamptz, time_zone text)
returns timestamptz
language sql stable set search_path = ''
as $$
  select case
    when overdue_run_at.kind = 'task'
         and (overdue_run_at.starts_at at time zone overdue_run_at.time_zone)::time = time '23:59'
      then (date_trunc('day', overdue_run_at.starts_at at time zone overdue_run_at.time_zone)
            + interval '1 day 9 hours') at time zone overdue_run_at.time_zone
    else overdue_run_at.starts_at
  end
$$;

-- ---------------------------------------------------------------------------
-- Queuing, from a trigger on items
-- ---------------------------------------------------------------------------

create index outbox_scheduled_item_idx on public.outbox ((payload ->> 'item_id'))
  where kind in ('reminder', 'overdue') and status = 'pending';

create index outbox_scheduled_due_idx on public.outbox (run_at)
  where kind in ('reminder', 'overdue') and status in ('pending', 'sending');

create function public.is_open_state(state text)
returns boolean
language sql immutable set search_path = ''
as $$
  select is_open_state.state in ('needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage')
$$;

create function public.items_schedule_jobs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_insert boolean := tg_op = 'INSERT';
  v_open boolean := public.is_open_state(new.state);
  v_was_open boolean := not v_insert and public.is_open_state(old.state);
  v_moved boolean := not v_insert and old.starts_at is distinct from new.starts_at;
  v_run_at timestamptz;
begin
  -- Reminders: for the confirmed owner of an Assigned item.
  if v_insert
     or old.state is distinct from new.state
     or old.owner_id is distinct from new.owner_id
     or v_moved then
    if not v_insert then
      update public.outbox o
      set status = 'done', last_error = 'superseded'
      where o.kind = 'reminder' and o.status = 'pending' and o.payload ->> 'item_id' = new.id::text;
    end if;

    if new.state = 'assigned' and new.owner_id is not null then
      select public.reminder_run_at(new.kind, new.starts_at, c.time_zone) into v_run_at
      from public.circles c where c.id = new.circle_id;
      if v_run_at > now() then
        insert into public.outbox (circle_id, kind, run_at, payload)
        values (new.circle_id, 'reminder', v_run_at, jsonb_build_object(
          'item_id', new.id,
          'recipient_id', new.owner_id,
          'starts_at', new.starts_at
        ));
      end if;
    end if;
  end if;

  -- Overdue: once per due time, for an open item. Moving between open states
  -- (asked, accepted, covered) keeps the job already queued.
  if not v_insert and (v_was_open <> v_open or v_moved) then
    update public.outbox o
    set status = 'done', last_error = 'superseded'
    where o.kind = 'overdue' and o.status = 'pending' and o.payload ->> 'item_id' = new.id::text;
  end if;
  if v_open and (v_insert or not v_was_open or v_moved) then
    select public.overdue_run_at(new.kind, new.starts_at, c.time_zone) into v_run_at
    from public.circles c where c.id = new.circle_id;
    if v_run_at > now() then
      insert into public.outbox (circle_id, kind, run_at, payload)
      values (new.circle_id, 'overdue', v_run_at, jsonb_build_object(
        'item_id', new.id,
        'starts_at', new.starts_at
      ));
    end if;
  end if;

  return null;
end $$;

create trigger items_schedule_jobs
  after insert or update of state, owner_id, starts_at on public.items
  for each row
  execute function public.items_schedule_jobs();

-- ---------------------------------------------------------------------------
-- Sending: the worker claims reminder and overdue jobs as well as push.
-- Same as 20261003000000_outbox_push_worker.sql, with the kinds widened.
-- ---------------------------------------------------------------------------

create or replace function public.claim_outbox_jobs(max_jobs integer default 10)
returns setof public.outbox
language plpgsql security definer set search_path = ''
as $$
begin
  update public.outbox o
  set status = 'failed',
      last_error = coalesce(o.last_error, 'worker_did_not_finish')
  where o.id in (
    select x.id from public.outbox x
    where x.kind in ('push', 'reminder', 'overdue')
      and x.status = 'sending' and x.run_at <= now() and x.attempts >= 5
    for update skip locked
  );

  return query
  with due as (
    select x.id from public.outbox x
    where x.kind in ('push', 'reminder', 'overdue')
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

-- The cron's catch-up calls the worker when any job it sends is due. This is
-- what starts reminders and overdue alerts, within a minute of run_at.
create or replace function public.outbox_catch_up()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.outbox o
    where o.kind in ('push', 'reminder', 'overdue')
      and o.status in ('pending', 'sending') and o.run_at <= now()
  ) then
    perform public.invoke_outbox_worker();
  end if;
end $$;

-- Turns a claimed overdue job (one with no recipient_id) into one overdue job
-- per person to tell, due now, and marks it done, all in one transaction so a
-- retry never alerts twice. `attempt` is the job's attempts as claimed, as for
-- finish_outbox_job. Returns how many people will be told: 0 if the item is
-- gone, no longer open or now due at another time (the job is dropped), or if
-- the job isn't this worker's to expand.
--
-- Told: the owner, or the proposed assignee if not yet accepted, and every
-- admin, once each. An item with nobody on it alerts only the admins.
create function public.expand_overdue_job(job_id bigint, attempt integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_job public.outbox;
  v_item public.items;
  v_holder uuid;
  v_told uuid[];
begin
  select o.* into v_job
  from public.outbox o
  where o.id = expand_overdue_job.job_id
    and o.kind = 'overdue'
    and o.status = 'sending'
    and o.attempts = expand_overdue_job.attempt
    and not (o.payload ? 'recipient_id')
  for update;
  if not found then
    return 0;
  end if;

  select i.* into v_item
  from public.items i
  where i.id::text = v_job.payload ->> 'item_id';

  if v_item.id is null
     or not public.is_open_state(v_item.state)
     or v_item.starts_at is distinct from (v_job.payload ->> 'starts_at')::timestamptz then
    update public.outbox o
    set status = 'done', last_error = 'stale'
    where o.id = v_job.id;
    return 0;
  end if;

  -- The person on it first, then the admins; each member once.
  v_holder := coalesce(v_item.owner_id, v_item.proposed_assignee_id);
  select coalesce(array_agg(cm.user_id order by cm.user_id is distinct from v_holder, cm.user_id), '{}')
  into v_told
  from public.circle_members cm
  where cm.circle_id = v_item.circle_id
    and (cm.role = 'admin' or cm.user_id = v_holder);

  insert into public.outbox (circle_id, kind, payload)
  select v_item.circle_id, 'overdue', jsonb_build_object(
    'item_id', v_item.id,
    'starts_at', v_item.starts_at,
    'recipient_id', u.id
  )
  from unnest(v_told) as u(id);

  if cardinality(v_told) > 0 then
    perform public.log_item_event(v_item, null, 'overdue_alerted', jsonb_build_object(
      'starts_at', v_item.starts_at,
      'told', to_jsonb(v_told)
    ));
  end if;

  update public.outbox o
  set status = 'done', last_error = null, run_at = now()
  where o.id = v_job.id;

  return cardinality(v_told);
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what: only the worker expands jobs; the helpers are internal.
-- claim_outbox_jobs and outbox_catch_up keep their grants (create or replace).
-- ---------------------------------------------------------------------------

revoke execute on function
  public.reminder_run_at(text, timestamptz, text),
  public.overdue_run_at(text, timestamptz, text),
  public.is_open_state(text),
  public.items_schedule_jobs(),
  public.expand_overdue_job(bigint, integer)
from public, anon, authenticated, service_role;

grant execute on function public.expand_overdue_job(bigint, integer) to service_role;
