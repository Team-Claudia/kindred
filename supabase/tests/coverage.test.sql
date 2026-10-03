-- Task 3.1: coverage (PRD Epic 8, BR-01).
--
-- People: Alice, Bob and Erin are in circle X (America/Vancouver). Carol is in
-- circle Y. Dave isn't in any circle. As in items.test.sql, each check of
-- history and pushes reads only what was written since the previous check.
begin;
select plan(79);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('c0000000-0000-0000-0000-00000000000c'), -- Carol
  ('d0000000-0000-0000-0000-00000000000d'), -- Dave
  ('e0000000-0000-0000-0000-00000000000e'); -- Erin

update public.profiles p set display_name = n.name
from (values
  ('a0000000-0000-0000-0000-00000000000a'::uuid, 'Alice Smith'),
  ('b0000000-0000-0000-0000-00000000000b'::uuid, 'Bob Jones'),
  ('c0000000-0000-0000-0000-00000000000c'::uuid, 'Carol White'),
  ('e0000000-0000-0000-0000-00000000000e'::uuid, 'Erin Lee')
) as n(id, name)
where p.id = n.id;

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Vancouver'),
  ('20000000-0000-0000-0000-000000000002', 'Mum', 'America/Vancouver');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c');

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

-- An item at a glance: "state owner=<first name> v<version>".
create function pg_temp.summary(name text) returns text language sql security definer as $$
  select i.state || ' owner=' || coalesce(split_part(o.display_name, ' ', 1), '-') || ' v' || i.version
  from public.items i
  left join public.profiles o on o.id = i.owner_id
  where i.id = pg_temp.id(name)
$$;

-- An item's coverage requests: "<requester> <status> [by <taker>]", by requester.
create function pg_temp.covers(name text) returns text language sql security definer as $$
  select coalesce(string_agg(
    coalesce(split_part(rq.display_name, ' ', 1), '-') || ' ' || r.status
      || coalesce(' by ' || split_part(tk.display_name, ' ', 1), '')
      || case when r.status <> 'open' and r.resolved_at is null then ' (unresolved!)' else '' end,
    ', ' order by rq.display_name, r.status), '')
  from public.coverage_requests r
  left join public.profiles rq on rq.id = r.requester_id
  left join public.profiles tk on tk.id = r.taken_by
  where r.item_id = pg_temp.id(name)
$$;

create function pg_temp.events() returns text language plpgsql security definer as $$
declare
  v_text text;
  v_max bigint;
begin
  select string_agg(e.type || ' by ' || coalesce(split_part(p.display_name, ' ', 1), '-'), ', ' order by e.id),
         max(e.id)
  into v_text, v_max
  from public.activity_events e
  left join public.profiles p on p.id = e.actor_id
  where e.id > coalesce(nullif(current_setting('test.event_mark', true), '')::bigint, 0);
  if v_max is not null then
    perform set_config('test.event_mark', v_max::text, true);
  end if;
  return coalesce(v_text, '');
end $$;

-- The data of the newest history row.
create function pg_temp.last_event_data() returns jsonb language sql security definer as $$
  select e.data from public.activity_events e order by e.id desc limit 1
$$;

create function pg_temp.pushes() returns text language plpgsql security definer as $$
declare
  v_text text;
  v_max bigint;
begin
  select string_agg((o.payload ->> 'event') || ' ' || coalesce(split_part(p.display_name, ' ', 1), '-'),
                    ', ' order by o.payload ->> 'event', p.display_name),
         max(o.id)
  into v_text, v_max
  from public.outbox o
  left join public.profiles p on p.id = (o.payload ->> 'recipient_id')::uuid
  where o.id > coalesce(nullif(current_setting('test.outbox_mark', true), '')::bigint, 0);
  if v_max is not null then
    perform set_config('test.outbox_mark', v_max::text, true);
  end if;
  return coalesce(v_text, '');
end $$;

create function pg_temp.error_detail(sql text) returns text language plpgsql as $$
declare
  v_detail text;
begin
  execute sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail;
end $$;

-- ---------------------------------------------------------------------------
-- Items. c1–c3 are Assigned to Alice; n1 Needs someone; w1 is Awaiting Bob.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.c1', public.create_item('appointment', 'Cardiology', now() + interval '2 days',
  location => 'General Hospital', private_notes => 'Bring the medication list',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.c2', public.create_item('task', 'Call the pharmacy', now() + interval '3 days',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.c3', public.create_item('task', 'Groceries', now() + interval '4 days',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select set_config('test.n1', public.create_item('task', 'Laundry', now() + interval '1 day')::text, true);
select set_config('test.w1', public.create_item('task', 'Physio ride', now() + interval '1 day',
  assignee_id => 'b0000000-0000-0000-0000-00000000000b')::text, true);
select set_config('test.d1', public.create_item('task', 'Done already', now(),
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select public.complete_item(pg_temp.id('d1'), 1);
select pg_temp.events();
select pg_temp.pushes();

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
select is(public.coverage_remaining(), 2, 'a member starts the month with 2 coverage requests');

select pg_temp.sign_in_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.coverage_remaining() $$, 'P0001', 'not_member',
  'someone in no circle has no coverage allowance');

select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select throws_ok(format(s.sql, pg_temp.id('c1')), 'P0001', 'not_member',
  format('a member of another circle can''t call %s', s.fn))
from (values
  ('request_coverage', 'select public.request_coverage(%L, 1)'),
  ('cancel_coverage', 'select public.cancel_coverage(%L, 1)'),
  ('accept_coverage', 'select public.accept_coverage(%L, 1)')
) as s(fn, sql);
select is(public.coverage_remaining(), 2, 'Carol''s allowance is her own');

-- ---------------------------------------------------------------------------
-- request_coverage
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.request_coverage(%L, 1)', pg_temp.id('c1')),
  'P0001', 'not_owner', 'only the owner can ask for cover');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.request_coverage(%L, 1)', pg_temp.id('n1')),
  'P0001', 'invalid_state', 'a Needs someone item can''t be put up for cover');
select throws_ok(format('select public.request_coverage(%L, 1)', pg_temp.id('w1')),
  'P0001', 'invalid_state', 'nor can an Awaiting acceptance item');
select throws_ok(format('select public.request_coverage(%L, 2)', pg_temp.id('d1')),
  'P0001', 'invalid_state', 'nor a Completed one');
select throws_ok(format('select public.request_coverage(%L, 0)', pg_temp.id('c1')),
  'P0001', 'stale_version', 'asking at an old version is stale_version');
select is(pg_temp.events(), '', 'failed requests write no history');
select is(pg_temp.pushes(), '', 'and queue no pushes');
select is(public.coverage_remaining(), 2, 'and use none of the allowance');

select is((public.request_coverage(pg_temp.id('c1'), 1)).state, 'needs_coverage',
  'the owner asks for cover on an Assigned item');
select is(pg_temp.summary('c1'), 'needs_coverage owner=Alice v2', 'it stays hers until someone takes it');
select is(pg_temp.covers('c1'), 'Alice open', 'with an open coverage request');
select is(pg_temp.events(), 'coverage_requested by Alice', 'one history row');
select is(pg_temp.last_event_data(), '{}'::jsonb, 'with no data (the seed matches)');
select is(pg_temp.pushes(), 'coverage_requested Bob, coverage_requested Erin',
  'every other member is told, but not the owner');
select is(public.coverage_remaining(), 1, '1 of 2 left this month');

select throws_ok(format('select public.request_coverage(%L, 2)', pg_temp.id('c1')),
  'P0001', 'invalid_state', 'a Needs coverage item can''t be put up again');
select throws_ok(format('select public.accept_coverage(%L, 2)', pg_temp.id('c1')),
  'P0001', 'invalid_state', 'the owner can''t take their own request');

-- ---------------------------------------------------------------------------
-- cancel_coverage
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.cancel_coverage(%L, 2)', pg_temp.id('c1')),
  'P0001', 'not_owner', 'only the owner can cancel their request');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.cancel_coverage(%L, 1)', pg_temp.id('c1')),
  'P0001', 'stale_version', 'cancelling at an old version is stale_version');
select is(pg_temp.events(), '', 'failed calls write no history');

select is((public.cancel_coverage(pg_temp.id('c1'), 2)).state, 'assigned', 'the owner cancels the request');
select is(pg_temp.summary('c1'), 'assigned owner=Alice v3', 'Needs coverage → Assigned, still hers');
select is(pg_temp.covers('c1'), 'Alice cancelled', 'the request is cancelled');
select is(pg_temp.events(), 'coverage_cancelled by Alice', 'one history row');
select is(pg_temp.pushes(), '', 'nobody needs telling');
select is(public.coverage_remaining(), 1, 'BR-01: a cancelled request still counts');

select throws_ok(format('select public.cancel_coverage(%L, 3)', pg_temp.id('c1')),
  'P0001', 'invalid_state', 'there''s nothing left to cancel');

-- ---------------------------------------------------------------------------
-- The limit (BR-01)
-- ---------------------------------------------------------------------------
select is((public.request_coverage(pg_temp.id('c2'), 1)).state, 'needs_coverage', 'the second request this month');
select is(pg_temp.events(), 'coverage_requested by Alice', 'one history row');
select is(pg_temp.pushes(), 'coverage_requested Bob, coverage_requested Erin', 'everyone else is told');
select is(public.coverage_remaining(), 0, 'none left');

select throws_ok(format('select public.request_coverage(%L, 1)', pg_temp.id('c3')),
  'P0001', 'coverage_limit_reached', 'a third request in the same month is refused');
select throws_ok(format('select public.request_coverage(%L, 3)', pg_temp.id('c1')),
  'P0001', 'coverage_limit_reached', 'including on an item whose request was cancelled');
select throws_ok(format('select public.request_coverage(%L, 0)', pg_temp.id('c3')),
  'P0001', 'coverage_limit_reached', 'the limit is checked before the version');
select is(pg_temp.summary('c3'), 'assigned owner=Alice v1', 'the item is untouched');
select is(pg_temp.events(), '', 'and nothing is written');
select is(pg_temp.pushes(), '', 'or sent');

-- ---------------------------------------------------------------------------
-- accept_coverage, and two people tapping I can do it at once (M3)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.accept_coverage(%L, 1)', pg_temp.id('c2')),
  'P0001', 'stale_version', 'taking it at an old version is stale_version');
select is((public.accept_coverage(pg_temp.id('c2'), 2)).state, 'assigned', 'Bob taps I can do it');
select is(pg_temp.summary('c2'), 'assigned owner=Bob v3', 'BR-03: Bob is the confirmed owner straight away');
select is(pg_temp.covers('c2'), 'Alice taken by Bob', 'the request is taken, by Bob');
select is(pg_temp.events(), 'coverage_taken by Bob', 'one history row');
select is(pg_temp.last_event_data() ->> 'previous_owner_id', 'a0000000-0000-0000-0000-00000000000a',
  'which records who had it');
select is(pg_temp.pushes(), 'coverage_taken Alice', 'Alice is told');
select is((public.accept_coverage(pg_temp.id('c2'), 2)).version, 3,
  'tapping again once it''s yours changes nothing (a double tap is harmless)');
select is(public.coverage_remaining(), 2, 'BR-01: taking cover for others doesn''t use your allowance');

-- Erin taps from the same screen, at the version Bob also saw.
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format('select public.accept_coverage(%L, 2)', pg_temp.id('c2')),
  'P0001', 'coverage_resolved', 'the second I can do it gets coverage_resolved, not stale_version');
select is(pg_temp.error_detail(format('select public.accept_coverage(%L, 2)', pg_temp.id('c2')))::jsonb ->> 'name',
  'Bob Jones', 'coverage_resolved names who''s covering it');
select throws_ok(format('select public.accept_coverage(%L, 1)', pg_temp.id('n1')),
  'P0001', 'invalid_state', 'a Needs someone item can''t be taken this way (nobody is covering it)');
select throws_ok(format('select public.accept_coverage(%L, 2)', pg_temp.id('d1')),
  'P0001', 'invalid_state', 'nor can a Completed one');
select throws_ok(format('select public.cancel_coverage(%L, 3)', pg_temp.id('c2')),
  'P0001', 'not_owner', 'someone else can''t cancel it either');

-- Alice tries to take her request back too late.
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.cancel_coverage(%L, 2)', pg_temp.id('c2')),
  'P0001', 'coverage_resolved', 'cancelling after someone took it is coverage_resolved');
select is(pg_temp.error_detail(format('select public.cancel_coverage(%L, 2)', pg_temp.id('c2')))::jsonb ->> 'name',
  'Bob Jones', 'and names the new owner');
select is(pg_temp.summary('c2'), 'assigned owner=Bob v3', 'Bob still has it');
select is(public.coverage_remaining(), 0, 'a taken request still counts');
select is(pg_temp.events(), '', 'failed calls write no history');
select is(pg_temp.pushes(), '', 'and queue no pushes');

-- The new owner can ask for cover in turn, from their own allowance.
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is((public.request_coverage(pg_temp.id('c2'), 3)).state, 'needs_coverage', 'Bob asks for cover on it');
select is(pg_temp.pushes(), 'coverage_requested Alice, coverage_requested Erin', 'everyone but Bob is told');
select is(public.coverage_remaining(), 1, 'it comes out of Bob''s allowance');
select pg_temp.events();

-- An item with open coverage can still be cancelled (BR-08), which closes the request.
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select is((public.cancel_item(pg_temp.id('c2'), 4)).state, 'cancelled', 'Needs coverage → Cancelled');
select is(pg_temp.covers('c2'), 'Alice taken by Bob, Bob cancelled', 'the open request is cancelled');
select throws_ok(format('select public.accept_coverage(%L, 4)', pg_temp.id('c2')),
  'P0001', 'invalid_state', 'a cancelled item can''t be taken, and nobody is said to be covering it');
select pg_temp.events();
select pg_temp.pushes();

-- ---------------------------------------------------------------------------
-- The month is the circle's (BR-01, BR-09)
-- ---------------------------------------------------------------------------
reset role;

-- Erin's requests at fixed times, either side of a month boundary in
-- Vancouver. 2030-10-31 23:30 in Vancouver is already 1 November in UTC.
insert into public.coverage_requests (circle_id, item_id, requester_id, status, created_at, resolved_at)
values
  ('10000000-0000-0000-0000-000000000001', pg_temp.id('c3'), 'e0000000-0000-0000-0000-00000000000e',
   'cancelled', '2030-10-31 23:30:00 America/Vancouver', '2030-10-31 23:31:00 America/Vancouver'),
  ('10000000-0000-0000-0000-000000000001', pg_temp.id('c3'), 'e0000000-0000-0000-0000-00000000000e',
   'cancelled', '2030-11-01 00:30:00 America/Vancouver', '2030-11-01 00:31:00 America/Vancouver'),
  ('10000000-0000-0000-0000-000000000001', pg_temp.id('c3'), 'e0000000-0000-0000-0000-00000000000e',
   'cancelled', '2030-11-30 23:59:00 America/Vancouver', '2030-11-30 23:59:30 America/Vancouver');

select is(public.coverage_used('e0000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001',
  '2030-10-15 12:00:00 America/Vancouver'), 1,
  'a request at 11:30 pm on 31 October in the circle''s time zone counts for October');
select is(public.coverage_used('e0000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001',
  '2030-11-01 00:00:00 America/Vancouver'), 2,
  'the count resets at midnight on the 1st: November has its own two');
select is(public.coverage_used('e0000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001',
  '2030-12-01 00:00:00 America/Vancouver'), 0, 'and December starts again at 0');

update public.circles c set time_zone = 'Asia/Tokyo' where c.id = '10000000-0000-0000-0000-000000000001';
select is(public.coverage_used('e0000000-0000-0000-0000-00000000000e', '10000000-0000-0000-0000-000000000001',
  '2030-10-15 12:00:00 Asia/Tokyo'), 0,
  'the same requests fall in other months for a circle in another time zone');
update public.circles c set time_zone = 'America/Vancouver' where c.id = '10000000-0000-0000-0000-000000000001';

-- This month, relative to now: one request a second before the month began
-- (last month) and one at its first instant (this month).
insert into public.coverage_requests (circle_id, item_id, requester_id, status, created_at, resolved_at)
select '10000000-0000-0000-0000-000000000001', pg_temp.id('c3'), 'e0000000-0000-0000-0000-00000000000e',
  'cancelled', m.starts + s.offset_by, now()
from (select date_trunc('month', now() at time zone 'America/Vancouver') at time zone 'America/Vancouver' as starts) m,
  (values (interval '-1 second'), (interval '0')) as s(offset_by);

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select is(public.coverage_remaining(), 1, 'only this month''s requests, in the circle''s time zone, count');

-- ---------------------------------------------------------------------------
-- Outbox payloads and history are privacy-safe (ADR-010)
-- ---------------------------------------------------------------------------
reset role;
select is_empty(
  $$ select 1 from public.outbox o
     where o.kind = 'push' and (o.status <> 'pending'
        or (select array_agg(k order by k) from jsonb_object_keys(o.payload) k)
           <> array['actor_id', 'event', 'item_id', 'recipient_id']) $$,
  'every push job is pending and holds only IDs and an event name'
);
select is_empty(
  $$ select 1 from public.outbox o, public.items i
     where o.payload::text ilike '%' || i.title || '%'
        or o.payload::text ilike '%' || coalesce(i.private_notes, '<none>') || '%'
        or o.payload::text ilike '%' || coalesce(i.location, '<none>') || '%' $$,
  'no outbox job contains a title, note or location'
);
select is_empty(
  $$ select 1 from public.activity_events e, public.items i
     where e.type like 'coverage_%'
       and (e.data::text ilike '%' || i.title || '%'
            or e.data::text ilike '%' || coalesce(i.private_notes, '<none>') || '%') $$,
  'no coverage history row contains a title or note'
);

select ok(
  not has_function_privilege('authenticated', 'public.coverage_used(uuid, uuid, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.coverage_used(uuid, uuid, timestamptz)', 'execute'),
  'the counting helper can''t be called from the app'
);
select ok(
  has_function_privilege('authenticated', 'public.coverage_remaining()', 'execute')
    and has_function_privilege('authenticated', 'public.request_coverage(uuid, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.cancel_coverage(uuid, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.accept_coverage(uuid, integer)', 'execute')
    and not has_function_privilege('anon', 'public.accept_coverage(uuid, integer)', 'execute'),
  'signed-in members can call the coverage RPCs; signed-out visitors can''t'
);

select * from finish();
rollback;
