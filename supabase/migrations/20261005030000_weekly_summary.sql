-- Task 4.5g: weekly summary (plan §4.2–§4.4, ADR-016, PRD US 10.3).
--
-- - weekly_summary(week_start): fills in the stub from the initial schema.
--   Read on demand, runs as the caller so RLS applies, and returns structured
--   lines that the app turns into fixed en-CA sentences. It never copies
--   update text: updates are only counted, per author.
-- - queue_weekly_summaries(): run by pg_cron every 15 minutes. On Sunday
--   from 08:00 in each circle's time zone it queues one `weekly_summary`
--   outbox job per member, {recipient_id, week_start}, once per week.
-- - claim_outbox_jobs and outbox_catch_up take `weekly_summary` jobs as well
--   as push, reminder and overdue, so the worker sends "Your weekly summary
--   is ready" within a minute.

-- ---------------------------------------------------------------------------
-- The summary
-- ---------------------------------------------------------------------------

-- The week is Monday to Sunday in the circle's time zone; any date in it
-- names it (week_start is moved back to its Monday). Lines, in this order:
--
--   completed      An item completed during the week. person_id = who did
--                  it, at = when.
--   missed         An appointment in the week whose time has passed while
--                  someone was on it (owner, or the person asked), still not
--                  marked done. person_id = them, at = its time.
--   unowned        The same, with nobody on it.
--   overdue        A task still open past its due time, due before the week
--                  ends. Tasks can still be done, so they're "still open".
--                  person_id = who's on it, or null for nobody.
--   needs_someone  An item in Needs someone that isn't due yet, due before the
--                  end of the following week. person_id is null.
--   updates        Per author, how many updates they posted during the week
--                  (count); at = their latest. person_id null = Former member.
--
-- item_id and item_title are null for `updates`; count is null for the rest.
-- Errors: not_member (the caller has no circle), invalid_input (no date).
create or replace function public.weekly_summary(week_start date)
returns table (
  kind text,
  item_id uuid,
  item_title text,
  person_id uuid,
  at timestamptz,
  count integer
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_circle uuid;
  v_tz text;
  v_monday date;
  v_start timestamptz;
  v_end timestamptz;
  v_horizon timestamptz;
  v_now timestamptz := now();
begin
  if weekly_summary.week_start is null then
    raise exception 'invalid_input';
  end if;

  select cm.circle_id, c.time_zone into v_circle, v_tz
  from public.circle_members cm
  join public.circles c on c.id = cm.circle_id
  where cm.user_id = auth.uid();
  if v_circle is null then
    raise exception 'not_member';
  end if;

  v_monday := weekly_summary.week_start - (extract(isodow from weekly_summary.week_start)::integer - 1);
  v_start := v_monday::timestamp at time zone v_tz;
  v_end := (v_monday + 7)::timestamp at time zone v_tz;
  v_horizon := (v_monday + 14)::timestamp at time zone v_tz;

  return query
  select s.kind, s.item_id, s.item_title, s.person_id, s.at, s.count
  from (
    select 1 as rank, 'completed'::text as kind, i.id as item_id, i.title as item_title,
           e.actor_id as person_id, e.at as at, null::integer as count
    from public.activity_events e
    join public.items i on i.id = e.item_id
    where e.circle_id = v_circle
      and e.type = 'completed'
      and e.at >= v_start and e.at < v_end
      and i.state = 'completed'

    union all

    select case when coalesce(i.owner_id, i.proposed_assignee_id) is null then 3 else 2 end,
           case when coalesce(i.owner_id, i.proposed_assignee_id) is null then 'unowned' else 'missed' end,
           i.id, i.title, coalesce(i.owner_id, i.proposed_assignee_id), i.starts_at, null
    from public.items i
    where i.circle_id = v_circle
      and i.kind = 'appointment'
      and i.state in ('needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage')
      and i.starts_at >= v_start and i.starts_at < least(v_end, v_now)

    union all

    select 4, 'overdue', i.id, i.title, coalesce(i.owner_id, i.proposed_assignee_id), i.starts_at, null
    from public.items i
    where i.circle_id = v_circle
      and i.kind = 'task'
      and i.state in ('needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage')
      and i.starts_at < least(v_end, v_now)

    union all

    select 5, 'needs_someone', i.id, i.title, null, i.starts_at, null
    from public.items i
    where i.circle_id = v_circle
      and i.state = 'needs_someone'
      and i.starts_at >= v_now and i.starts_at < v_horizon

    union all

    select 6, 'updates', null, null, u.author_id, max(u.created_at), count(*)::integer
    from public.updates u
    where u.circle_id = v_circle
      and u.created_at >= v_start and u.created_at < v_end
    group by u.author_id
  ) s
  order by s.rank, s.at, s.item_title, s.person_id;
end $$;

-- ---------------------------------------------------------------------------
-- The Sunday notification
-- ---------------------------------------------------------------------------

create index outbox_weekly_summary_idx on public.outbox (circle_id, (payload ->> 'week_start'))
  where kind = 'weekly_summary';

-- Queues one weekly_summary job per member of every circle where it's Sunday
-- between 08:00 and 12:00 in the circle's time zone at `as_of`, for the week
-- ending that Sunday. A member who already has one for that week is skipped,
-- so running it every 15 minutes sends each member one a week (and someone
-- who joins on Sunday morning still gets theirs). The window covers time
-- zones that aren't a whole number of hours from UTC. Returns how many jobs
-- it queued. as_of is for tests; pg_cron uses now().
create function public.queue_weekly_summaries(as_of timestamptz default now())
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.outbox (circle_id, kind, payload)
  select d.circle_id, 'weekly_summary', jsonb_build_object(
    'recipient_id', cm.user_id,
    'week_start', d.week_start
  )
  from (
    select c.id as circle_id,
           ((queue_weekly_summaries.as_of at time zone c.time_zone)::date - 6) as week_start
    from public.circles c
    where extract(isodow from queue_weekly_summaries.as_of at time zone c.time_zone) = 7
      and (queue_weekly_summaries.as_of at time zone c.time_zone)::time >= time '08:00'
      and (queue_weekly_summaries.as_of at time zone c.time_zone)::time < time '12:00'
  ) d
  join public.circle_members cm on cm.circle_id = d.circle_id
  where not exists (
    select 1 from public.outbox o
    where o.kind = 'weekly_summary'
      and o.circle_id = d.circle_id
      and o.payload ->> 'week_start' = d.week_start::text
      and o.payload ->> 'recipient_id' = cm.user_id::text
  );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- cron.schedule with the same name replaces the job.
select cron.schedule('weekly-summary', '*/15 * * * *', 'select public.queue_weekly_summaries()');

-- ---------------------------------------------------------------------------
-- Sending: the worker claims weekly_summary jobs too. Same as
-- 20261004040000_reminders.sql, with the kinds widened.
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
    where x.kind in ('push', 'reminder', 'overdue', 'weekly_summary')
      and x.status = 'sending' and x.run_at <= now() and x.attempts >= 5
    for update skip locked
  );

  return query
  with due as (
    select x.id from public.outbox x
    where x.kind in ('push', 'reminder', 'overdue', 'weekly_summary')
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

create or replace function public.outbox_catch_up()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.outbox o
    where o.kind in ('push', 'reminder', 'overdue', 'weekly_summary')
      and o.status in ('pending', 'sending') and o.run_at <= now()
  ) then
    perform public.invoke_outbox_worker();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what: only pg_cron queues the jobs. weekly_summary,
-- claim_outbox_jobs and outbox_catch_up keep their grants (create or replace).
-- ---------------------------------------------------------------------------

revoke execute on function public.queue_weekly_summaries(timestamptz)
from public, anon, authenticated, service_role;
