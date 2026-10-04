-- Task 4.5b: reminders and overdue alerts (plan §4.4, ADR-010).
--
-- People: Alice (admin), Bob and Erin are in circle X (America/Toronto, which
-- changes its clocks, unlike Vancouver in CI's time zone data). Alice runs
-- every RPC unless the test says otherwise. Each item's jobs are read with
-- pg_temp.jobs(), which lists its pending reminder and overdue jobs.
begin;
select plan(66);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('e0000000-0000-0000-0000-00000000000e'); -- Erin

update public.profiles p set display_name = n.name
from (values
  ('a0000000-0000-0000-0000-00000000000a'::uuid, 'Alice Smith'),
  ('b0000000-0000-0000-0000-00000000000b'::uuid, 'Bob Jones'),
  ('e0000000-0000-0000-0000-00000000000e'::uuid, 'Erin Lee')
) as n(id, name)
where p.id = n.id;

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto');

insert into public.circle_members (circle_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', 'member');

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.id(name text) returns uuid language sql as $$
  select current_setting('test.' || name)::uuid
$$;

create function pg_temp.ver(name text) returns integer language sql security definer as $$
  select i.version from public.items i where i.id = pg_temp.id(name)
$$;

-- An item's pending scheduled jobs: "<kind> <recipient first name or ->", sorted.
create function pg_temp.jobs(name text) returns text language sql security definer as $$
  select coalesce(string_agg(o.kind || ' ' || coalesce(split_part(p.display_name, ' ', 1), '-'),
                             ', ' order by o.kind, p.display_name), '')
  from public.outbox o
  left join public.profiles p on p.id = (o.payload ->> 'recipient_id')::uuid
  where o.kind in ('reminder', 'overdue') and o.status = 'pending'
    and o.payload ->> 'item_id' = pg_temp.id(name)::text
$$;

-- When an item's pending job of one kind runs.
create function pg_temp.run_at(name text, job_kind text) returns timestamptz language sql security definer as $$
  select o.run_at from public.outbox o
  where o.kind = job_kind and o.status = 'pending' and o.payload ->> 'item_id' = pg_temp.id(name)::text
$$;

-- The payload of an item's pending job of one kind.
create function pg_temp.payload(name text, job_kind text) returns jsonb language sql security definer as $$
  select o.payload from public.outbox o
  where o.kind = job_kind and o.status = 'pending' and o.payload ->> 'item_id' = pg_temp.id(name)::text
$$;

-- reminder_run_at in this circle's time zone (it is internal, so not callable
-- while signed in).
create function pg_temp.reminder_at(item_kind text, starts_at timestamptz) returns timestamptz
language sql security definer as $$
  select public.reminder_run_at(item_kind, starts_at, 'America/Toronto')
$$;

-- How many of an item's jobs were superseded.
create function pg_temp.superseded(name text) returns bigint language sql security definer as $$
  select count(*) from public.outbox o
  where o.status = 'done' and o.last_error = 'superseded'
    and o.payload ->> 'item_id' = pg_temp.id(name)::text
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('service_role', 'public.expand_overdue_job(bigint, integer)', 'execute'),
  'the worker can expand overdue jobs');
select ok(not has_function_privilege('authenticated', 'public.expand_overdue_job(bigint, integer)', 'execute'),
  'signed-in users cannot expand overdue jobs');
select ok(not has_function_privilege('authenticated', 'public.reminder_run_at(text, timestamptz, text)', 'execute'),
  'reminder_run_at is internal');
select ok(not has_function_privilege('authenticated', 'public.overdue_run_at(text, timestamptz, text)', 'execute'),
  'overdue_run_at is internal');
select has_trigger('public', 'items', 'items_schedule_jobs', 'a trigger on items queues the jobs');

-- ---------------------------------------------------------------------------
-- Lead times, in the circle's time zone
-- ---------------------------------------------------------------------------

select is(public.reminder_run_at('appointment', '2026-11-01 15:00 America/Toronto', 'America/Toronto'),
  '2026-11-01 13:00 America/Toronto'::timestamptz, 'an appointment is reminded 2 hours before');
select is(public.reminder_run_at('appointment', '2026-11-01 09:30 America/Toronto', 'America/Toronto'),
  '2026-11-01 07:30 America/Toronto'::timestamptz, 'even an early one');
select is(public.reminder_run_at('task', '2026-10-31 15:00 America/Toronto', 'America/Toronto'),
  '2026-10-31 13:00+00'::timestamptz, 'a task is reminded at 9 am on its due day (EDT)');
select is(public.reminder_run_at('task', '2026-11-01 15:00 America/Toronto', 'America/Toronto'),
  '2026-11-01 14:00+00'::timestamptz, '9 am local on the day the clocks go back (EST)');
select is(public.reminder_run_at('task', '2026-03-08 15:00 America/Toronto', 'America/Toronto'),
  '2026-03-08 13:00+00'::timestamptz, '9 am local on the day the clocks go forward (EDT)');
select is(public.reminder_run_at('task', '2026-03-07 15:00 America/Toronto', 'America/Toronto'),
  '2026-03-07 14:00+00'::timestamptz, 'and the day before (EST)');
select is(public.reminder_run_at('task', '2026-10-05 11:00 America/Toronto', 'America/Toronto'),
  '2026-10-05 09:00 America/Toronto'::timestamptz, 'a task due at 11 am is reminded at 9 am');
select is(public.reminder_run_at('task', '2026-10-05 10:59 America/Toronto', 'America/Toronto'),
  '2026-10-05 08:59 America/Toronto'::timestamptz, 'a task due before 11 am is reminded 2 hours before');
select is(public.reminder_run_at('task', '2026-10-05 20:00+00', 'America/Toronto'),
  '2026-10-05 13:00+00'::timestamptz, 'the due day is the circle''s: 9 am in Toronto');
select is(public.reminder_run_at('task', '2026-10-05 20:00+00', 'America/Vancouver'),
  '2026-10-05 16:00+00'::timestamptz, 'and 9 am in Vancouver for a Vancouver circle');

select is(public.overdue_run_at('appointment', '2026-11-01 15:00 America/Toronto', 'America/Toronto'),
  '2026-11-01 15:00 America/Toronto'::timestamptz, 'an appointment is overdue at its start');
select is(public.overdue_run_at('task', '2026-11-01 15:00 America/Toronto', 'America/Toronto'),
  '2026-11-01 15:00 America/Toronto'::timestamptz, 'a task with a time is overdue at that time');
select is(public.overdue_run_at('task', '2026-10-31 23:59 America/Toronto', 'America/Toronto'),
  '2026-11-01 14:00+00'::timestamptz,
  'a task with no time (23:59) is alerted at 9 am the next morning, across the clock change');

-- ---------------------------------------------------------------------------
-- create_item
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');

select set_config('test.open', public.create_item('task', 'Groceries', now() + interval '1 day')::text, true);
select is(pg_temp.jobs('open'), 'overdue -', 'an open item gets an overdue job and no reminder');
select is(pg_temp.run_at('open', 'overdue'), now() + interval '1 day', 'due at its due time');
select is(
  pg_temp.payload('open', 'overdue'),
  jsonb_build_object('item_id', pg_temp.id('open'), 'starts_at', now() + interval '1 day'),
  'the overdue payload holds the item and its due time only'
);

select set_config('test.notime', public.create_item('task', 'Pharmacy run',
  (date_trunc('day', now() at time zone 'America/Toronto') + interval '1 day 23 hours 59 minutes')
    at time zone 'America/Toronto')::text, true);
select is(pg_temp.run_at('notime', 'overdue'),
  (date_trunc('day', now() at time zone 'America/Toronto') + interval '2 days 9 hours') at time zone 'America/Toronto',
  'a task with no time is alerted the next morning, not at midnight');

select set_config('test.mine', public.create_item('appointment', 'Dentist', now() + interval '2 hours 5 minutes',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is(pg_temp.jobs('mine'), 'overdue -, reminder Alice', 'assigning yourself queues your reminder');
select is(pg_temp.run_at('mine', 'reminder'), now() + interval '5 minutes',
  'an appointment 2 h 5 min away is reminded in 5 minutes');
select is(
  pg_temp.payload('mine', 'reminder'),
  jsonb_build_object('item_id', pg_temp.id('mine'), 'recipient_id', 'a0000000-0000-0000-0000-00000000000a'::uuid,
    'starts_at', now() + interval '2 hours 5 minutes'),
  'the reminder payload holds IDs and the time only'
);

select set_config('test.soon', public.create_item('appointment', 'Physio', now() + interval '1 hour',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is(pg_temp.jobs('soon'), 'overdue -', 'no reminder when its time has already passed');

select set_config('test.past', public.create_item('task', 'Laundry', now() - interval '1 hour',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is(pg_temp.jobs('past'), '', 'nothing for an item already past due');

-- ---------------------------------------------------------------------------
-- Asked, accepted, reassigned, claimed
-- ---------------------------------------------------------------------------

select set_config('test.ask', public.create_item('appointment', 'Cardiology', now() + interval '3 days',
  assignee_id => 'b0000000-0000-0000-0000-00000000000b')::text, true);
select is(pg_temp.jobs('ask'), 'overdue -', 'no reminder before acceptance');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select public.accept_assignment(pg_temp.id('ask'), pg_temp.ver('ask'));
select is(pg_temp.jobs('ask'), 'overdue -, reminder Bob', 'accepting queues the reminder');
select is(pg_temp.run_at('ask', 'reminder'), now() + interval '3 days' - interval '2 hours', 'at the lead time');
select is(pg_temp.superseded('ask'), 0::bigint, 'the overdue job is kept');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.assign(pg_temp.id('ask'), pg_temp.ver('ask'), 'e0000000-0000-0000-0000-00000000000e');
select is(pg_temp.jobs('ask'), 'overdue -', 'reassigning drops Bob''s reminder; Erin has not accepted');
select is(pg_temp.superseded('ask'), 1::bigint, 'only the reminder was superseded');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select public.accept_assignment(pg_temp.id('ask'), pg_temp.ver('ask'));
select is(pg_temp.jobs('ask'), 'overdue -, reminder Erin', 'Erin gets the reminder once she accepts');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select public.claim(pg_temp.id('open'), pg_temp.ver('open'));
select is(pg_temp.jobs('open'), 'overdue -, reminder Bob', 'claiming queues a reminder');
select is(pg_temp.run_at('open', 'reminder'),
  pg_temp.reminder_at('task', now() + interval '1 day'),
  'a task''s reminder uses the circle time zone');

-- ---------------------------------------------------------------------------
-- Changing the time
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.update_item(pg_temp.id('mine'), pg_temp.ver('mine'), jsonb_build_object('title', 'Dentist (Dr Lee)'));
select is(pg_temp.superseded('mine'), 0::bigint, 'an edit that keeps the time keeps the jobs');

select public.update_item(pg_temp.id('mine'), pg_temp.ver('mine'),
  jsonb_build_object('starts_at', now() + interval '1 day'));
select is(pg_temp.jobs('mine'), 'overdue -, reminder Alice', 'the owner moving it requeues both');
select is(pg_temp.run_at('mine', 'reminder'), now() + interval '1 day' - interval '2 hours', 'at the new lead time');
select is(pg_temp.run_at('mine', 'overdue'), now() + interval '1 day', 'and the new due time');
select is(pg_temp.superseded('mine'), 2::bigint, 'the old jobs were superseded');

-- Someone else moving an Assigned item asks the owner to reconfirm (BR-11).
select public.update_item(pg_temp.id('ask'), pg_temp.ver('ask'),
  jsonb_build_object('starts_at', now() + interval '4 days'));
select is(pg_temp.jobs('ask'), 'overdue -', 'no reminder while Erin reconfirms; a new overdue job');
select is(pg_temp.run_at('ask', 'overdue'), now() + interval '4 days', 'at the new due time');

select set_config('test.moved', public.create_item('task', 'Pharmacy run', now() + interval '2 days',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select public.update_item(pg_temp.id('moved'), pg_temp.ver('moved'),
  jsonb_build_object('starts_at', now() + interval '3 days'));
select public.update_item(pg_temp.id('moved'), pg_temp.ver('moved'),
  jsonb_build_object('starts_at', now() + interval '2 days'));
select is(pg_temp.jobs('moved'), 'overdue -, reminder Alice', 'moving away and back leaves one of each');

-- ---------------------------------------------------------------------------
-- Coverage, completing and cancelling
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select public.request_coverage(pg_temp.id('open'), pg_temp.ver('open'));
select is(pg_temp.jobs('open'), 'overdue -', 'asking for cover drops the reminder, keeps the overdue job');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select public.accept_coverage(pg_temp.id('open'), pg_temp.ver('open'));
select is(pg_temp.jobs('open'), 'overdue -, reminder Erin', 'whoever covers gets the reminder');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.complete_item(pg_temp.id('mine'), pg_temp.ver('mine'));
select is(pg_temp.jobs('mine'), '', 'completing drops both');

select public.cancel_item(pg_temp.id('moved'), pg_temp.ver('moved'));
select is(pg_temp.jobs('moved'), '', 'cancelling drops both');

-- ---------------------------------------------------------------------------
-- Items inserted in bulk (as recurrence will): overdue for each, reminders
-- only for Assigned ones.
-- ---------------------------------------------------------------------------
reset role;

insert into public.items (id, circle_id, kind, title, starts_at, state, owner_id, proposed_assignee_id) values
  ('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'task', 'Groceries',
   now() + interval '7 days', 'needs_someone', null, null),
  ('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'task', 'Groceries',
   now() + interval '14 days', 'awaiting_acceptance', null, 'b0000000-0000-0000-0000-00000000000b'),
  ('f0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'task', 'Groceries',
   now() + interval '21 days', 'assigned', 'b0000000-0000-0000-0000-00000000000b', null);
select set_config('test.r1', 'f0000000-0000-0000-0000-000000000001', true);
select set_config('test.r2', 'f0000000-0000-0000-0000-000000000002', true);
select set_config('test.r3', 'f0000000-0000-0000-0000-000000000003', true);
select is(pg_temp.jobs('r1') || ' | ' || pg_temp.jobs('r2') || ' | ' || pg_temp.jobs('r3'),
  'overdue - | overdue - | overdue -, reminder Bob',
  'bulk-inserted items each get an overdue job; only the Assigned one a reminder');

-- ---------------------------------------------------------------------------
-- Sending: claim, catch-up and the overdue fan-out
-- ---------------------------------------------------------------------------

-- Pretend the due times have come: everything pending so far runs later than
-- now, so move the jobs for 'ask' (Erin reconfirming) and 'r1' (nobody on it).
update public.outbox o set run_at = now() - interval '1 minute'
where o.status = 'pending' and o.kind = 'overdue'
  and o.payload ->> 'item_id' in (pg_temp.id('ask')::text, pg_temp.id('r1')::text, pg_temp.id('r3')::text);
update public.outbox o set run_at = now() - interval '1 minute'
where o.status = 'pending' and o.kind = 'reminder' and o.payload ->> 'item_id' = pg_temp.id('r3')::text;

-- Earlier RPCs queued pushes, and the seed data's appointments geocode jobs;
-- set them aside so only scheduled jobs are due.
update public.outbox set status = 'done' where kind in ('push', 'geocode') and status in ('pending', 'sending');

create temp table claimed as
select * from public.claim_outbox_jobs(10);
select is((select count(*) from claimed), 4::bigint, 'due reminder and overdue jobs are claimed');
select is((select count(*) from claimed where kind = 'reminder'), 1::bigint, 'one reminder among them');

select is(
  public.expand_overdue_job((select id from claimed where payload ->> 'item_id' = pg_temp.id('ask')::text), 0),
  0, 'expanding with the wrong attempt does nothing'
);
select is(
  public.expand_overdue_job((select id from claimed where payload ->> 'item_id' = pg_temp.id('ask')::text), 1),
  2, 'an overdue alert for an asked item tells two people'
);
select is(pg_temp.jobs('ask'), 'overdue Alice, overdue Erin',
  'the proposed assignee and the admin, one job each');
select is(
  (select array_agg(k order by k) from public.outbox o, jsonb_object_keys(o.payload) k
   where o.kind = 'overdue' and o.status = 'pending' and o.payload ->> 'item_id' = pg_temp.id('ask')::text
     and o.payload ->> 'recipient_id' = 'e0000000-0000-0000-0000-00000000000e'),
  array['item_id', 'recipient_id', 'starts_at'], 'each holds IDs and the due time only'
);
select is(
  (select o.status from public.outbox o, claimed c where o.id = c.id and c.payload ->> 'item_id' = pg_temp.id('ask')::text),
  'done', 'the expanded job is done'
);
select is(
  (select e.data -> 'told' from public.activity_events e
   where e.item_id = pg_temp.id('ask') and e.type = 'overdue_alerted'),
  '["e0000000-0000-0000-0000-00000000000e", "a0000000-0000-0000-0000-00000000000a"]'::jsonb,
  'history says who was told, the person on it first'
);
select is(
  public.expand_overdue_job((select id from claimed where payload ->> 'item_id' = pg_temp.id('ask')::text), 1),
  0, 'a job is never expanded twice'
);
select is(pg_temp.jobs('ask'), 'overdue Alice, overdue Erin', 'so nobody is told twice');

select is(
  public.expand_overdue_job((select id from claimed where payload ->> 'item_id' = pg_temp.id('r1')::text), 1),
  1, 'an item with nobody on it alerts only the admins'
);
select is(pg_temp.jobs('r1'), 'overdue Alice', 'that is, Alice');

-- An item completed after its job was claimed sends nothing.
update public.items set state = 'completed', owner_id = 'b0000000-0000-0000-0000-00000000000b'
where id = pg_temp.id('r3');
select is(
  public.expand_overdue_job((select id from claimed where kind = 'overdue' and payload ->> 'item_id' = pg_temp.id('r3')::text), 1),
  0, 'a completed item is not alerted'
);
select is(
  (select o.status || '/' || o.last_error from public.outbox o, claimed c
   where o.id = c.id and c.kind = 'overdue' and c.payload ->> 'item_id' = pg_temp.id('r3')::text),
  'done/stale', 'its job is dropped as stale'
);
select is(
  (select count(*) from public.activity_events e where e.item_id = pg_temp.id('r3') and e.type = 'overdue_alerted'),
  0::bigint, 'and no history is written'
);

-- The admin who is also on the item is told once.
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.own', public.create_item('task', 'Call the pharmacy', now() + interval '5 days',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
reset role;
update public.outbox o set status = 'sending', attempts = 1
where o.kind = 'overdue' and o.status = 'pending' and o.payload ->> 'item_id' = pg_temp.id('own')::text;
select is(
  public.expand_overdue_job((select o.id from public.outbox o
    where o.kind = 'overdue' and o.status = 'sending' and o.payload ->> 'item_id' = pg_temp.id('own')::text), 1),
  1, 'an admin who owns the item is told once'
);

-- The cron's catch-up calls the worker when a reminder or overdue job is due.
create temp table queued_before as select count(*) as n from net.http_request_queue;
select vault.create_secret('https://project.example.test/functions/v1/outbox-worker', 'outbox_worker_url');
select vault.create_secret('test-secret', 'outbox_worker_secret');
select public.outbox_catch_up();
select is((select count(*) from net.http_request_queue), (select n + 1 from queued_before),
  'the catch-up calls the worker for due reminder and overdue jobs');

select * from finish();
rollback;
