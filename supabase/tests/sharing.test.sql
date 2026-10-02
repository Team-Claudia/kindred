-- Task 3.2: log_share (plan §4.2).
--
-- People: Alice and Bob are in circle X. Carol is in circle Y. Dave isn't in
-- any circle.
begin;
select plan(13);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('c0000000-0000-0000-0000-00000000000c'), -- Carol
  ('d0000000-0000-0000-0000-00000000000d'); -- Dave

insert into public.circles (id, care_recipient_name) values
  ('10000000-0000-0000-0000-000000000001', 'Dad'),
  ('20000000-0000-0000-0000-000000000002', 'Mum');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c');

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------

-- Act as a signed-in user. auth.uid() reads the JWT claims.
create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- An item ID saved under a short name, e.g. pg_temp.id('t1').
create function pg_temp.id(name text) returns uuid language sql as $$
  select current_setting('test.' || name)::uuid
$$;

-- 'shared' history rows for an item: "<share_kind> by <actor id>", oldest first.
create function pg_temp.shares(name text) returns text language sql security definer as $$
  select coalesce(string_agg(
    (e.data ->> 'share_kind') || ' by ' || coalesce(e.actor_id::text, '-')
      || case when e.circle_id is distinct from i.circle_id then ' (wrong circle!)' else '' end,
    ', ' order by e.id), '')
  from public.activity_events e
  join public.items i on i.id = e.item_id
  where e.item_id = pg_temp.id(name) and e.type = 'shared'
$$;

create function pg_temp.event_count() returns bigint language sql security definer as $$
  select count(*) from public.activity_events
$$;

create function pg_temp.outbox_count() returns bigint language sql security definer as $$
  select count(*) from public.outbox
$$;

-- An item at a glance: "<state> v<version> <updated_at>".
create function pg_temp.item_row(name text) returns text language sql security definer as $$
  select i.state || ' v' || i.version || ' ' || i.updated_at::text
  from public.items i where i.id = pg_temp.id(name)
$$;

-- ---------------------------------------------------------------------------
-- Setup: Alice adds a task in circle X.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.t1', public.create_item('task', 'Pick up prescriptions', now() + interval '1 day')::text, true);

select set_config('test.t1_before', pg_temp.item_row('t1'), true);
select set_config('test.events_before', pg_temp.event_count()::text, true);
select set_config('test.outbox_before', pg_temp.outbox_count()::text, true);

-- ---------------------------------------------------------------------------
-- A member logs a share: one 'shared' row, nothing else changes.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select lives_ok(format('select public.log_share(%L, %L)', pg_temp.id('t1'), 'task'),
  'a member can log sharing an item in their circle');
select is(pg_temp.shares('t1'), 'task by b0000000-0000-0000-0000-00000000000b',
  'it writes one shared activity_events row with share_kind and the sharer');
select is(pg_temp.event_count(), current_setting('test.events_before')::bigint + 1,
  'and no other history');
select is(pg_temp.outbox_count(), current_setting('test.outbox_before')::bigint,
  'it queues no outbox rows');
select is(pg_temp.item_row('t1'), current_setting('test.t1_before'),
  'the item''s state, version and updated_at are unchanged');

-- Every builder kind is accepted.
select lives_ok(format(
  'select public.log_share(%1$L, ''appointment''); select public.log_share(%1$L, ''assignment_request''); select public.log_share(%1$L, ''coverage_request'')',
  pg_temp.id('t1')), 'every item share kind is accepted');
select is(pg_temp.shares('t1'),
  'task by b0000000-0000-0000-0000-00000000000b, appointment by b0000000-0000-0000-0000-00000000000b, '
  || 'assignment_request by b0000000-0000-0000-0000-00000000000b, coverage_request by b0000000-0000-0000-0000-00000000000b',
  'one row per share, in order');

-- ---------------------------------------------------------------------------
-- Errors
-- ---------------------------------------------------------------------------
select set_config('test.events_before', pg_temp.event_count()::text, true);

select throws_ok(format('select public.log_share(%L, %L)', pg_temp.id('t1'), 'invite'),
  'P0001', 'invalid_input', 'an unknown share_kind raises invalid_input');
select throws_ok(format('select public.log_share(%L, null)', pg_temp.id('t1')),
  'P0001', 'invalid_input', 'a missing share_kind raises invalid_input');

select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select throws_ok(format('select public.log_share(%L, %L)', pg_temp.id('t1'), 'bogus'),
  'P0001', 'not_member', 'another circle''s member gets not_member, before the share_kind is checked');

select pg_temp.sign_in_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok(format('select public.log_share(%L, %L)', pg_temp.id('t1'), 'task'),
  'P0001', 'not_member', 'someone outside any circle gets not_member');

select is(pg_temp.event_count(), current_setting('test.events_before')::bigint,
  'failed calls write no history');

-- ---------------------------------------------------------------------------
-- Who can call it
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.log_share(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.log_share(uuid, text)', 'execute'),
  'signed-in members can call log_share; signed-out visitors can''t'
);

select * from finish();
rollback;
