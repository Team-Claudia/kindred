-- Task 4.5g: weekly summary (plan §4.2–§4.4, ADR-016).
--
-- People: Alice (admin), Bob and Erin are in circle X (America/Toronto, which
-- changes its clocks, unlike Vancouver in CI's time zone data). Zed is alone
-- in circle Y (Asia/Kolkata, UTC+5:30). Nora is in no circle.
--
-- Most of the history is in the week of Mon 2 – Sun 8 March 2026, when
-- Toronto sprang forward (8 March, 2 am). That week runs from
-- 2026-03-02 05:00 UTC (midnight EST) to 2026-03-09 04:00 UTC (midnight EDT).
begin;
select plan(32);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('e0000000-0000-0000-0000-00000000000e'), -- Erin
  ('20000000-0000-0000-0000-00000000000f'), -- Zed
  ('30000000-0000-0000-0000-00000000000c'); -- Nora

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto'),
  ('10000000-0000-0000-0000-000000000002', 'Gran', 'Asia/Kolkata');

insert into public.circle_members (circle_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'member'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000f', 'admin');

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- An item in circle X, with a readable ID ('i' then a number).
create function pg_temp.item(n integer, item_kind text, title text, starts_at timestamptz,
                             state text, owner uuid default null, asked uuid default null)
returns void language sql as $$
  insert into public.items (id, circle_id, kind, title, starts_at, state, owner_id, proposed_assignee_id)
  values (('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
          '10000000-0000-0000-0000-000000000001', item_kind, title, starts_at, state, owner, asked);
$$;

create function pg_temp.iid(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

create function pg_temp.completed(n integer, actor uuid, at timestamptz) returns void language sql as $$
  insert into public.activity_events (circle_id, actor_id, type, item_id, at)
  values ('10000000-0000-0000-0000-000000000001', actor, 'completed', pg_temp.iid(n), at);
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.weekly_summary(date)', 'execute'),
  'signed-in users can read the summary');
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.weekly_summary(date)'::regprocedure),
  'weekly_summary runs as the caller, so RLS applies');
select ok(not has_function_privilege('authenticated', 'public.queue_weekly_summaries(timestamptz)', 'execute'),
  'signed-in users cannot queue the Sunday jobs');

-- ---------------------------------------------------------------------------
-- The week of 2–8 March 2026
-- ---------------------------------------------------------------------------

-- Completed, in and around the week.
select pg_temp.item(1, 'task', 'Groceries drop-off', '2026-03-04 12:00 America/Toronto', 'completed', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.completed(1, 'b0000000-0000-0000-0000-00000000000b', '2026-03-04 11:00 America/Toronto');
select pg_temp.item(2, 'task', 'Pharmacy call', '2026-03-08 23:59 America/Toronto', 'completed', 'e0000000-0000-0000-0000-00000000000e');
select pg_temp.completed(2, 'e0000000-0000-0000-0000-00000000000e', '2026-03-09 03:30+00'); -- Sun 8, 11:30 pm EDT
select pg_temp.item(3, 'task', 'Next Monday thing', '2026-03-09 12:00 America/Toronto', 'completed', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.completed(3, 'b0000000-0000-0000-0000-00000000000b', '2026-03-09 04:30+00'); -- Mon 9, 12:30 am EDT
select pg_temp.item(4, 'task', 'Last Sunday thing', '2026-03-01 12:00 America/Toronto', 'completed', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.completed(4, 'b0000000-0000-0000-0000-00000000000b', '2026-03-02 04:30+00'); -- Sun 1, 11:30 pm EST

-- Appointments whose time has passed, still open.
select pg_temp.item(5, 'appointment', 'Dentist', '2026-03-05 15:00 America/Toronto', 'assigned', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.item(6, 'appointment', 'Physio ride', '2026-03-06 09:30 America/Toronto', 'needs_someone');
select pg_temp.item(7, 'appointment', 'Eye exam', '2026-03-03 10:00 America/Toronto', 'awaiting_acceptance', null, 'e0000000-0000-0000-0000-00000000000e');
select pg_temp.item(8, 'appointment', 'Cancelled visit', '2026-03-03 11:00 America/Toronto', 'cancelled');

-- Tasks still open past their due time.
select pg_temp.item(9, 'task', 'Refill meds', '2026-03-03 17:00 America/Toronto', 'assigned', 'e0000000-0000-0000-0000-00000000000e');
select pg_temp.item(10, 'task', 'Old paperwork', '2026-02-20 17:00 America/Toronto', 'needs_someone');
select pg_temp.item(11, 'task', 'After the week', '2026-03-10 17:00 America/Toronto', 'assigned', 'b0000000-0000-0000-0000-00000000000b');

-- Updates: never copied, only counted.
insert into public.updates (circle_id, author_id, body, created_at) values
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'Secret update text one', '2026-03-03 10:00 America/Toronto'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'Secret update text two', '2026-03-09 03:30+00'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Secret update text three', '2026-03-05 10:00 America/Toronto'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'Secret update text four', '2026-03-09 04:30+00');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select kind, item_id, person_id, at from public.weekly_summary('2026-03-02') where kind = 'completed' $$,
  $$ values
     ('completed'::text, pg_temp.iid(1), 'b0000000-0000-0000-0000-00000000000b'::uuid, '2026-03-04 11:00 America/Toronto'::timestamptz),
     ('completed'::text, pg_temp.iid(2), 'e0000000-0000-0000-0000-00000000000e'::uuid, '2026-03-09 03:30+00'::timestamptz) $$,
  'completed: what was done during the week, by whom and when'
);
select is(
  (select count(*) from public.weekly_summary('2026-03-02') where item_id = pg_temp.iid(2)),
  1::bigint, 'the week ends at midnight Sunday EDT, after the clocks went forward'
);
select is(
  (select count(*) from public.weekly_summary('2026-03-02') where item_id in (pg_temp.iid(3), pg_temp.iid(4))),
  0::bigint, 'completions just before Monday midnight EST and just after Sunday midnight EDT are left out'
);

select results_eq(
  $$ select kind, item_id, person_id from public.weekly_summary('2026-03-02') where kind in ('missed', 'unowned') $$,
  $$ values
     ('missed'::text, pg_temp.iid(7), 'e0000000-0000-0000-0000-00000000000e'::uuid),
     ('missed'::text, pg_temp.iid(5), 'b0000000-0000-0000-0000-00000000000b'::uuid),
     ('unowned'::text, pg_temp.iid(6), null::uuid) $$,
  'missed and unowned: past appointments still open, with who was on them; cancelled ones are left out'
);

select results_eq(
  $$ select kind, item_id, item_title, person_id, at from public.weekly_summary('2026-03-02') where kind = 'overdue' $$,
  $$ values
     ('overdue'::text, pg_temp.iid(10), 'Old paperwork'::text, null::uuid, '2026-02-20 17:00 America/Toronto'::timestamptz),
     ('overdue'::text, pg_temp.iid(9), 'Refill meds'::text, 'e0000000-0000-0000-0000-00000000000e'::uuid, '2026-03-03 17:00 America/Toronto'::timestamptz) $$,
  'overdue: open tasks due before the week ended, oldest first, including ones with nobody on them'
);

select results_eq(
  $$ select kind, item_id, item_title, person_id, count from public.weekly_summary('2026-03-02') where kind = 'updates' $$,
  $$ values
     ('updates'::text, null::uuid, null::text, 'e0000000-0000-0000-0000-00000000000e'::uuid, 1),
     ('updates'::text, null::uuid, null::text, 'b0000000-0000-0000-0000-00000000000b'::uuid, 2) $$,
  'updates: how many each person posted during the week, in the circle''s time zone'
);

select is_empty(
  $$ select 1 from public.weekly_summary('2026-03-02') s
     where s.item_title ilike '%secret%' or s.kind ilike '%secret%' $$,
  'update text is never copied into the summary'
);

select is_empty(
  $$ select 1 from public.weekly_summary('2026-03-02') where kind = 'needs_someone' $$,
  'a past week lists nothing as still needing someone'
);

select results_eq(
  $$ select array_agg(kind order by ord) from public.weekly_summary('2026-03-02') with ordinality as s(kind, item_id, item_title, person_id, at, count, ord) $$,
  $$ values (array['completed', 'completed', 'missed', 'missed', 'unowned', 'overdue', 'overdue', 'updates', 'updates']::text[]) $$,
  'lines come in a fixed order: what happened, what is still open, then updates'
);

select set_eq(
  $$ select kind, item_id from public.weekly_summary('2026-03-05') $$,
  $$ select kind, item_id from public.weekly_summary('2026-03-02') $$,
  'any day in the week names that week'
);

select results_eq(
  $$ select kind, item_id from public.weekly_summary('2026-02-23') where kind in ('completed', 'missed', 'unowned', 'updates') $$,
  $$ values ('completed'::text, pg_temp.iid(4)) $$,
  'the week before ends at midnight Sunday EST: it has the 11:30 pm completion and none of this week''s history'
);

-- This week: items that need someone soon.
reset role;
select pg_temp.item(12, 'task', 'Soon', now() + interval '1 day', 'needs_someone');
select pg_temp.item(13, 'task', 'Much later', now() + interval '30 days', 'needs_someone');
select pg_temp.item(14, 'task', 'Taken', now() + interval '1 day', 'assigned', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  $$ select kind, item_id, person_id from public.weekly_summary(current_date) where kind = 'needs_someone' $$,
  $$ values ('needs_someone'::text, pg_temp.iid(12), null::uuid) $$,
  'needs_someone: not yet due, before the end of next week, with nobody on it'
);
select ok(
  exists (select 1 from public.weekly_summary(current_date) where kind = 'overdue' and item_id = pg_temp.iid(11)),
  'this week''s summary lists every open task that is overdue now'
);

-- ---------------------------------------------------------------------------
-- RLS and errors
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-0000-0000-00000000000f');
select is_empty(
  $$ select 1 from public.weekly_summary('2026-03-02') $$,
  'someone in another circle sees nothing of this circle'
);

select pg_temp.sign_in_as('30000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select * from public.weekly_summary('2026-03-02') $$,
  'P0001', 'not_member', 'someone in no circle gets not_member'
);

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select * from public.weekly_summary(null) $$,
  'P0001', 'invalid_input', 'a missing week is invalid_input'
);

-- ---------------------------------------------------------------------------
-- The Sunday 08:00 job
-- ---------------------------------------------------------------------------

reset role;

create function pg_temp.queued(circle uuid) returns bigint language sql as $$
  select count(*) from public.outbox o where o.kind = 'weekly_summary' and o.circle_id = circle
$$;

select ok(
  exists (select 1 from cron.job where jobname = 'weekly-summary' and schedule = '*/15 * * * *'
          and command = 'select public.queue_weekly_summaries()'),
  'pg_cron checks for Sunday 08:00 every 15 minutes'
);

-- 1 Nov 2026 is the Sunday Toronto falls back (2 am EDT → 1 am EST), so
-- 08:00 that morning is 13:00 UTC, not 12:00.
select public.queue_weekly_summaries('2026-11-01 12:00+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000001'), 0::bigint,
  'nothing at 07:00 EST, which would be 08:00 before the clocks went back');
select public.queue_weekly_summaries('2026-10-31 13:00+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000001'), 0::bigint, 'nothing on a Saturday');

select public.queue_weekly_summaries('2026-11-01 13:00+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000001'), 3::bigint,
  'at 08:00 Sunday in the circle''s time zone, one job per member');
select results_eq(
  $$ select payload from public.outbox where kind = 'weekly_summary'
       and circle_id = '10000000-0000-0000-0000-000000000001' order by payload ->> 'recipient_id' $$,
  $$ values
     ('{"recipient_id": "a0000000-0000-0000-0000-00000000000a", "week_start": "2026-10-26"}'::jsonb),
     ('{"recipient_id": "b0000000-0000-0000-0000-00000000000b", "week_start": "2026-10-26"}'::jsonb),
     ('{"recipient_id": "e0000000-0000-0000-0000-00000000000e", "week_start": "2026-10-26"}'::jsonb) $$,
  'each job names the member and the week ending that Sunday, nothing else'
);
select is(pg_temp.queued('10000000-0000-0000-0000-000000000002'), 0::bigint,
  'a circle where it is Sunday evening gets nothing');

select is(public.queue_weekly_summaries('2026-11-01 13:15+00'), 0,
  'running again that morning queues nothing more');

insert into auth.users (id) values ('d0000000-0000-0000-0000-00000000000d');
insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d');
select public.queue_weekly_summaries('2026-11-01 15:00+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000001'), 4::bigint,
  'someone who joins on Sunday morning still gets theirs');
select public.queue_weekly_summaries('2026-11-01 17:00+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000001'), 4::bigint,
  'nothing after noon');

-- Kolkata is UTC+5:30: 08:00 Sunday is 02:30 UTC.
select public.queue_weekly_summaries('2026-11-01 02:15+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000002'), 0::bigint,
  'nothing at 07:45 in a half-hour time zone');
select public.queue_weekly_summaries('2026-11-01 02:30+00');
select is(pg_temp.queued('10000000-0000-0000-0000-000000000002'), 1::bigint,
  'a half-hour time zone gets its job at 08:00');

-- The worker claims them, and the catch-up calls it.
-- Leave only this test's weekly_summary jobs due.
update public.outbox set status = 'done'
where status in ('pending', 'sending')
  and not (kind = 'weekly_summary' and circle_id in ('10000000-0000-0000-0000-000000000001',
                                                       '10000000-0000-0000-0000-000000000002'));
select is(
  (select count(*) from public.claim_outbox_jobs(50) where kind = 'weekly_summary'),
  5::bigint, 'the worker claims weekly_summary jobs'
);

update public.outbox set status = 'pending', run_at = now() - interval '1 minute' where kind = 'weekly_summary';
create temp table queued_before as select count(*) as n from net.http_request_queue;
select vault.create_secret('https://project.example.test/functions/v1/outbox-worker', 'outbox_worker_url');
select vault.create_secret('test-secret', 'outbox_worker_secret');
select public.outbox_catch_up();
select is((select count(*) from net.http_request_queue), (select n + 1 from queued_before),
  'the catch-up calls the worker for due weekly_summary jobs');

select * from finish();
rollback;
