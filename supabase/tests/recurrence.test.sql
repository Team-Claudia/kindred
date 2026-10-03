-- Task 4.5c: recurrence (plan §4.2, ADR-007, BR-10).
--
-- People: Alice and Bob are in circle X (America/Toronto, which changes its
-- clocks on 1 Nov 2026 and 14 Mar 2027, unlike Vancouver in CI's time zone
-- data). Alice creates every series. "Now" for making occurrences is fixed
-- per test with pg_temp.horizon(), which sets the 90-day horizon (and so now,
-- 90 days earlier), so the dates don't depend on when the tests run.
begin;
select plan(51);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'); -- Bob

update public.profiles p set display_name = n.name
from (values
  ('a0000000-0000-0000-0000-00000000000a'::uuid, 'Alice Smith'),
  ('b0000000-0000-0000-0000-00000000000b'::uuid, 'Bob Jones')
) as n(id, name)
where p.id = n.id;

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto');

insert into public.circle_members (circle_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'member');

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

-- "Now", fixed by the test. Rolled back with the transaction.
create or replace function public.series_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz
$$;

-- Makes occurrences up to horizon_at, as if it were 90 days earlier.
create function pg_temp.horizon(horizon_at timestamptz) returns void language sql as $$
  select set_config('test.now', (horizon_at - interval '90 days')::text, true);
$$;

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.id(name text) returns uuid language sql as $$
  select current_setting('test.' || name)::uuid
$$;

-- The occurrences in the same series as a saved item, first to last.
create function pg_temp.occurrences(name text) returns setof public.items
language sql security definer as $$
  select i.* from public.items i
  where i.series_id = (select x.series_id from public.items x where x.id = pg_temp.id(name))
  order by i.occurrence_index
$$;

-- Their start times, local (Toronto) or UTC, comma-separated.
create function pg_temp.local(name text) returns text language sql security definer as $$
  select string_agg(to_char(o.starts_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI'), ', ')
  from pg_temp.occurrences(name) o
$$;

create function pg_temp.utc(name text) returns text language sql security definer as $$
  select string_agg(to_char(o.starts_at at time zone 'UTC', 'MM-DD HH24:MI'), ', ')
  from pg_temp.occurrences(name) o
$$;

create function pg_temp.n(name text) returns integer language sql security definer as $$
  select count(*)::integer from pg_temp.occurrences(name)
$$;

-- Occurrence n's ID.
create function pg_temp.occ(name text, n integer) returns uuid language sql security definer as $$
  select o.id from pg_temp.occurrences(name) o where o.occurrence_index = n
$$;

-- Each occurrence's "state owner proposed", comma-separated.
create function pg_temp.states(name text) returns text language sql security definer as $$
  select string_agg(o.state
    || ' ' || coalesce(split_part(ow.display_name, ' ', 1), '-')
    || ' ' || coalesce(split_part(pa.display_name, ' ', 1), '-'), ', ')
  from pg_temp.occurrences(name) o
  left join public.profiles ow on ow.id = o.owner_id
  left join public.profiles pa on pa.id = o.proposed_assignee_id
$$;

-- How many outbox jobs of one kind (pending reminders and overdue alerts, or
-- any push) are for the series' occurrences.
create function pg_temp.jobs(name text, job_kind text) returns integer language sql security definer as $$
  select count(*)::integer from public.outbox j
  where j.kind = job_kind
    and (j.kind = 'push' or j.status = 'pending')
    and (j.payload ->> 'item_id')::uuid in (select o.id from pg_temp.occurrences(name) o)
$$;

-- How many `created` history rows the series' occurrences have, and by whom.
create function pg_temp.created(name text, by_kindred boolean default false) returns integer
language sql security definer as $$
  select count(*)::integer from public.activity_events e
  where e.type = 'created'
    and e.item_id in (select o.id from pg_temp.occurrences(name) o)
    and (not by_kindred or e.actor_id is null)
$$;

-- ---------------------------------------------------------------------------
-- Who can call what, and the nightly job
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('service_role', 'public.extend_all_series()', 'execute'),
  'the service role can run the nightly extension');
select ok(not has_function_privilege('authenticated', 'public.extend_all_series()', 'execute'),
  'signed-in users cannot');
select ok(not has_function_privilege('authenticated', 'public.extend_series(uuid, uuid)', 'execute'),
  'extend_series is internal');
select ok(
  exists (select 1 from cron.job where jobname = 'recurrence-nightly-extension' and schedule = '30 9 * * *'
          and command = 'select public.extend_all_series()'),
  'pg_cron extends every series nightly');

-- ---------------------------------------------------------------------------
-- Bad input
-- ---------------------------------------------------------------------------

select pg_temp.horizon('2027-01-01 00:00+00');
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');

select throws_ok($$ select public.create_item('task', 'Laundry', now(), repeat => 'yearly') $$,
  'P0001', 'invalid_input', 'repeat is daily, weekly or monthly');
select throws_ok($$ select public.create_item('task', 'Laundry', now(), until => now() + interval '1 month') $$,
  'P0001', 'invalid_input', 'an end date needs a repeat');
select throws_ok(
  $$ select public.create_item('task', 'Laundry', now(), repeat => 'daily', until => now() - interval '1 day') $$,
  'P0001', 'invalid_input', 'the end date can''t be before the start');

select set_config('test.one', public.create_item('appointment', 'Cardiology', now() + interval '1 day')::text, true);
select throws_ok(
  $$ select public.create_item('task', 'Book a follow-up', now(), repeat => 'weekly', follow_up_of => pg_temp.id('one')) $$,
  'P0001', 'invalid_input', 'a follow-up doesn''t repeat');
select is((select i.series_id from public.items i where i.id = pg_temp.id('one')), null,
  'a one-off item has no series');

-- ---------------------------------------------------------------------------
-- Daily for two weeks: 14 independent items
-- ---------------------------------------------------------------------------

select set_config('test.med', public.create_item(
  'task', 'Evening medication check', '2026-10-05 20:00 America/Toronto',
  repeat => 'daily', until => '2026-10-18 23:59 America/Toronto')::text, true);

select is(pg_temp.n('med'), 14, 'daily for two weeks makes 14 items');
select is((select o.id from pg_temp.occurrences('med') o limit 1), pg_temp.id('med'),
  'create_item returns the first occurrence');
select is((select array_agg(o.occurrence_index) from pg_temp.occurrences('med') o),
  array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 'numbered 0 to 13');
select is((select min(to_char(o.starts_at at time zone 'America/Toronto', 'HH24:MI'))
           || ' ' || max(to_char(o.starts_at at time zone 'America/Toronto', 'HH24:MI'))
           from pg_temp.occurrences('med') o),
  '20:00 20:00', 'all at 8 pm');
select is(to_char((select max(o.starts_at) from pg_temp.occurrences('med') o) at time zone 'America/Toronto', 'YYYY-MM-DD'),
  '2026-10-18', 'the last on the end date');
select is((select count(distinct o.state || o.title || o.version) from pg_temp.occurrences('med') o)::integer, 1,
  'each Needs someone with the same title, at version 1');
select is(pg_temp.created('med'), 14, 'each has its own created history row');
select is((select s.repeat || ' ' || s.next_index from public.series s
           where s.id = (select i.series_id from public.items i where i.id = pg_temp.id('med'))),
  'daily 14', 'the series stores the rule and the next occurrence');

-- Independence: claim and complete one, edit one, cancel one.
select set_config('test.m3', pg_temp.occ('med', 3)::text, true);
select set_config('test.m5', pg_temp.occ('med', 5)::text, true);
select set_config('test.m6', pg_temp.occ('med', 6)::text, true);

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.claim(pg_temp.id('m3'), 1) $$, 'Bob claims one occurrence');
select lives_ok($$ select public.complete_item(pg_temp.id('m3'), 2) $$, 'and completes it');
select lives_ok($$ select public.update_item(pg_temp.id('m5'), 1, '{"title": "Evening meds and a walk"}') $$,
  'Bob edits another');
select lives_ok($$ select public.cancel_item(pg_temp.id('m6'), 1) $$, 'and cancels a third');

select is(pg_temp.states('med'),
  'needs_someone - -, needs_someone - -, needs_someone - -, completed Bob -, '
  || 'needs_someone - -, needs_someone - -, cancelled - -, needs_someone - -, '
  || 'needs_someone - -, needs_someone - -, needs_someone - -, needs_someone - -, '
  || 'needs_someone - -, needs_someone - -',
  'the other occurrences are untouched');
select is((select count(*)::integer from pg_temp.occurrences('med') o where o.title = 'Evening medication check'), 13,
  'the edit changed one occurrence only');
select is((select count(*)::integer from pg_temp.occurrences('med') o where o.version = 1), 11,
  'and no other occurrence moved on a version');

-- ---------------------------------------------------------------------------
-- Weekly across the clocks going back (1 Nov 2026 in Toronto)
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.physio', public.create_item(
  'appointment', 'Drive Dad to physio', '2026-10-18 10:00 America/Toronto', '2026-10-18 11:30 America/Toronto',
  location => 'Physio clinic', repeat => 'weekly', until => '2026-11-08 23:59 America/Toronto')::text, true);

select is(pg_temp.local('physio'),
  '2026-10-18 10:00, 2026-10-25 10:00, 2026-11-01 10:00, 2026-11-08 10:00',
  'weekly keeps 10 am local through the end date');
select is(pg_temp.utc('physio'), '10-18 14:00, 10-25 14:00, 11-01 15:00, 11-08 15:00',
  'which is an hour later in UTC once the clocks go back');
select is((select string_agg(to_char(o.ends_at at time zone 'America/Toronto', 'HH24:MI') || ' ' || o.location, ', ')
           from pg_temp.occurrences('physio') o),
  '11:30 Physio clinic, 11:30 Physio clinic, 11:30 Physio clinic, 11:30 Physio clinic',
  'each keeps the end time and location');

-- ---------------------------------------------------------------------------
-- Monthly on the 31st, across the clocks going forward (14 Mar 2027)
-- ---------------------------------------------------------------------------

select pg_temp.horizon('2027-05-01 00:00+00');
select set_config('test.bills', public.create_item(
  'task', 'Pay Dad''s bills', '2027-01-31 09:00 America/Toronto',
  repeat => 'monthly', until => '2027-03-31 23:59 America/Toronto')::text, true);

select is(pg_temp.local('bills'),
  '2027-01-31 09:00, 2027-02-28 09:00, 2027-03-31 09:00',
  'monthly on the 31st falls on the last day of a shorter month, and back on the 31st');
select is(pg_temp.utc('bills'), '01-31 14:00, 02-28 14:00, 03-31 13:00',
  'at 9 am local before and after the clocks go forward');

select pg_temp.horizon('2028-03-01 00:00+00');
select set_config('test.leap', public.create_item(
  'task', 'Order supplies', '2027-12-29 08:00 America/Toronto',
  repeat => 'monthly', until => '2028-02-29 23:59 America/Toronto')::text, true);
select is(pg_temp.local('leap'),
  '2027-12-29 08:00, 2028-01-29 08:00, 2028-02-29 08:00',
  'the 29th exists in a leap-year February');

-- ---------------------------------------------------------------------------
-- The 90-day horizon and the nightly extension
-- ---------------------------------------------------------------------------

select pg_temp.horizon('2026-12-21 08:00 America/Toronto');
select set_config('test.walk', public.create_item(
  'task', 'Morning walk', '2026-12-01 08:00 America/Toronto', repeat => 'daily')::text, true);
select is(pg_temp.n('walk'), 21, 'with no end date, occurrences are made up to the horizon');

select set_config('test.far', public.create_item(
  'task', 'Renew passport', '2027-02-01 08:00 America/Toronto', repeat => 'weekly')::text, true);
select is(pg_temp.n('far'), 1, 'a series starting beyond the horizon still gets its first occurrence');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.claim(pg_temp.id('walk'), 1) $$, 'Bob claims the first walk');

reset role;
select pg_temp.horizon('2026-12-31 08:00 America/Toronto');
select is(public.extend_all_series(), 10, 'the nightly job adds the next 10 days of walks');
select is(pg_temp.n('walk'), 31, 'the open series now runs 10 days further');
select is(to_char((select max(o.starts_at) from pg_temp.occurrences('walk') o) at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI'),
  '2026-12-31 08:00', 'at the same local time');
select is(pg_temp.created('walk', by_kindred => true), 10, 'the added ones were created by Kindred, not a member');
select is((select count(*)::integer from pg_temp.occurrences('walk') o where o.state = 'needs_someone'), 30,
  'and Need someone; the claimed walk is still Bob''s');
select is(pg_temp.n('med') || ' ' || pg_temp.n('physio') || ' ' || pg_temp.n('bills'), '14 4 3',
  'series with an end date stop there');
select is(public.extend_all_series(), 0, 'running it again adds nothing');

select pg_temp.horizon('2027-03-01 08:00 America/Toronto');
select is(public.extend_all_series(), 64, 'a later night carries on: 60 walks and 4 weekly renewals');
select is(pg_temp.n('far') || ' ' || pg_temp.n('walk'), '5 91', 'both reach the new horizon');

-- ---------------------------------------------------------------------------
-- Assigning at creation asks about the first occurrence only
-- ---------------------------------------------------------------------------

select pg_temp.horizon('2027-01-01 00:00+00');
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.asked', public.create_item(
  'task', 'Water the plants', '2026-10-06 18:00 America/Toronto',
  assignee_id => 'b0000000-0000-0000-0000-00000000000b',
  repeat => 'weekly', until => '2026-10-20 23:59 America/Toronto')::text, true);
select is(pg_temp.states('asked'),
  'awaiting_acceptance - Bob, needs_someone - -, needs_someone - -',
  'Bob is asked about the first occurrence; the rest Need someone');
select is((select count(*)::integer from public.assignment_requests r
           where r.item_id in (select o.id from pg_temp.occurrences('asked') o)), 1,
  'with one assignment request');
select is(pg_temp.jobs('asked', 'push'), 1, 'and one push to Bob');

select set_config('test.mine', public.create_item(
  'task', 'Call the pharmacy', '2026-10-07 18:00 America/Toronto',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a',
  repeat => 'daily', until => '2026-10-08 23:59 America/Toronto')::text, true);
select is(pg_temp.states('mine'), 'assigned Alice -, needs_someone - -',
  'assigning yourself claims the first occurrence only');

-- ---------------------------------------------------------------------------
-- Reminders and overdue alerts (task 4.5b's trigger): one set per occurrence
-- ---------------------------------------------------------------------------

select pg_temp.horizon(now() + interval '90 days');
select set_config('test.soon', public.create_item(
  'appointment', 'Blood test', now() + interval '1 day',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a',
  repeat => 'daily', until => now() + interval '3 days 12 hours')::text, true);
select is(pg_temp.n('soon'), 3, 'three upcoming occurrences');
select is(pg_temp.jobs('soon', 'overdue') || ' ' || pg_temp.jobs('soon', 'reminder'), '3 1',
  'each has an overdue alert queued, and Alice''s first one a reminder');

reset role;
select public.extend_all_series();
select is(pg_temp.jobs('soon', 'overdue') || ' ' || pg_temp.jobs('soon', 'reminder'), '3 1',
  'the nightly job queues no duplicates');

-- ---------------------------------------------------------------------------
-- A series entered with a past start: the first as entered, then upcoming only
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.late', public.create_item(
  'task', 'Daily meds', now() - interval '10 days' + interval '3 hours',
  repeat => 'daily', until => now() + interval '2 days 12 hours')::text, true);
select is((select array_agg(o.occurrence_index) from pg_temp.occurrences('late') o), array[0, 10, 11, 12],
  'past occurrences after the first are skipped, not created overdue');
reset role;
select public.extend_all_series();
select is((select array_agg(o.occurrence_index) from pg_temp.occurrences('late') o), array[0, 10, 11, 12],
  'and the nightly job doesn''t fill them in later');

select * from finish();
rollback;
