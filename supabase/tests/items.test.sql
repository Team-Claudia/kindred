-- Task 2.1: the assignment state machine (PRD §17, ADR-006).
--
-- People: Alice, Bob and Erin are in circle X. Carol is in circle Y. Dave isn't
-- in any circle. Each check of history and pushes reads only what was written
-- since the previous check, so every successful transition is shown to write
-- exactly one activity_events row and the expected outbox rows.
begin;
select plan(164);

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

insert into public.circles (id, care_recipient_name) values
  ('10000000-0000-0000-0000-000000000001', 'Dad'),
  ('20000000-0000-0000-0000-000000000002', 'Mum');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e'),
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

create function pg_temp.ver(name text) returns integer language sql security definer as $$
  select i.version from public.items i where i.id = pg_temp.id(name)
$$;

-- An item at a glance: "state owner=<first name> proposed=<first name> v<version>".
create function pg_temp.summary(name text) returns text language sql security definer as $$
  select i.state
    || ' owner=' || coalesce(split_part(o.display_name, ' ', 1), '-')
    || ' proposed=' || coalesce(split_part(pa.display_name, ' ', 1), '-')
    || ' v' || i.version
  from public.items i
  left join public.profiles o on o.id = i.owner_id
  left join public.profiles pa on pa.id = i.proposed_assignee_id
  where i.id = pg_temp.id(name)
$$;

-- An item's assignment requests: "<status> <assignee> by <assigner>", sorted.
create function pg_temp.requests(name text) returns text language sql security definer as $$
  select coalesce(string_agg(
    r.status || ' ' || coalesce(split_part(ae.display_name, ' ', 1), '-')
      || ' by ' || coalesce(split_part(ar.display_name, ' ', 1), '-')
      || case when r.status <> 'pending' and r.resolved_at is null then ' (unresolved!)' else '' end,
    ', ' order by r.status, ae.display_name), '')
  from public.assignment_requests r
  left join public.profiles ae on ae.id = r.assignee_id
  left join public.profiles ar on ar.id = r.assigner_id
  where r.item_id = pg_temp.id(name)
$$;

-- History written since the last call: "<type> by <actor>", oldest first.
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

-- Push jobs queued since the last call: "<event> <recipient>", sorted.
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

-- The DETAIL of the error a statement raises.
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
-- create_item
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select set_config('test.y1', public.create_item('task', 'Carol''s task', now() + interval '1 day')::text, true);
select pg_temp.events();
select pg_temp.pushes();

select pg_temp.sign_in_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$ select public.create_item('task', 'Pick up prescriptions', now()) $$,
  'P0001', 'not_member', 'someone outside a circle can''t create an item'
);

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.create_item('chore', 'Laundry', now()) $$,
  'P0001', 'invalid_input', 'an item is a task or an appointment');
select throws_ok($$ select public.create_item('task', '   ', now()) $$,
  'P0001', 'invalid_input', 'an item needs a title');
select throws_ok($$ select public.create_item('appointment', 'Dentist', now(), now() - interval '1 hour') $$,
  'P0001', 'invalid_input', 'an item can''t end before it starts');
select throws_ok(
  $$ select public.create_item('task', 'Laundry', now(), assignee_id => 'c0000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'invalid_input', 'the assignee must be in the same circle');
select throws_ok(
  $$ select public.create_item('task', 'Laundry', now(), follow_up_of => pg_temp.id('y1')) $$,
  'P0001', 'invalid_input', 'a follow-up must be of an item in the same circle');
select throws_ok($$ select public.create_item('task', 'Laundry', now(), repeat => 'yearly') $$,
  'P0001', 'invalid_input', 'repeat is daily, weekly or monthly (recurrence.test.sql)');
select throws_ok($$ select public.create_item('task', 'Laundry', now(), until => now() + interval '1 month') $$,
  'P0001', 'invalid_input', 'an end date needs a repeat');
select is(pg_temp.events(), '', 'failed creates write no history');

select isnt(
  set_config('test.t1', public.create_item('task', '  Pick up prescriptions  ', now() + interval '1 day')::text, true),
  null, 'create_item returns the new item''s ID');
select is(pg_temp.summary('t1'), 'needs_someone owner=- proposed=- v1',
  'an item with no assignee Needs someone');
select is((select i.title || '/' || i.created_by::text from public.items i where i.id = pg_temp.id('t1')),
  'Pick up prescriptions/a0000000-0000-0000-0000-00000000000a',
  'the title is trimmed and the creator recorded');
select is(pg_temp.events(), 'created by Alice', 'creating writes one history row');
select is(pg_temp.pushes(), '', 'nobody is notified about an unassigned item');

select set_config('test.t2', public.create_item('appointment', 'Cardiology', now() + interval '2 days',
  now() + interval '2 days 1 hour', 'General Hospital', 'Bring the medication list',
  assignee_id => 'b0000000-0000-0000-0000-00000000000b')::text, true);
select is(pg_temp.summary('t2'), 'awaiting_acceptance owner=- proposed=Bob v1',
  'BR-02: an item created for someone else is Awaiting acceptance');
select is(pg_temp.requests('t2'), 'pending Bob by Alice', 'and has a pending request for them');
select is(pg_temp.events(), 'created by Alice', 'one history row');
select is(pg_temp.pushes(), 'assignment_requested Bob', 'the assignee is asked');

select set_config('test.t3', public.create_item('appointment', 'Physio', now() + interval '3 days',
  assignee_id => 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is(pg_temp.summary('t3'), 'assigned owner=Alice proposed=- v1',
  'BR-03: creating an item for yourself claims it');
select is(pg_temp.requests('t3'), '', 'with no assignment request');
select is(pg_temp.events(), 'created by Alice', 'one history row');
select is(pg_temp.pushes(), '', 'and no push to yourself');

select set_config('test.t4', public.create_item('task', 'Book a follow-up', now() + interval '4 days',
  follow_up_of => pg_temp.id('t1'))::text, true);
select is((select i.follow_up_of from public.items i where i.id = pg_temp.id('t4')), pg_temp.id('t1'),
  'a follow-up links to its item');
select is(pg_temp.events(), 'created by Alice', 'one history row');

-- ---------------------------------------------------------------------------
-- claim, and two people claiming at once (M2)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is((public.claim(pg_temp.id('t1'), 1)).state, 'assigned', 'Bob claims a Needs someone item');
select is(pg_temp.summary('t1'), 'assigned owner=Bob proposed=- v2',
  'BR-03: the claimer is the confirmed owner straight away');
select is(pg_temp.events(), 'claimed by Bob', 'claiming writes one history row');
select is(pg_temp.pushes(), '', 'claiming notifies nobody');

-- Erin claims from the same screen, at the version Bob also saw.
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format('select public.claim(%L, 1)', pg_temp.id('t1')),
  'P0001', 'already_claimed',
  'the second claim at the same version gets already_claimed, not stale_version');
select is(pg_temp.error_detail(format('select public.claim(%L, 1)', pg_temp.id('t1')))::jsonb ->> 'name',
  'Bob Jones', 'already_claimed names the owner');
select throws_ok(format('select public.claim(%L, 2)', pg_temp.id('t1')),
  'P0001', 'already_claimed', 'claiming at the latest version is still already_claimed');
select is(pg_temp.summary('t1'), 'assigned owner=Bob proposed=- v2', 'Bob still owns it');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is((public.claim(pg_temp.id('t1'), 1)).version, 2,
  'claiming your own item again changes nothing (a double tap is harmless)');
select is(pg_temp.events(), '', 'failed and repeated claims write no history');
select is(pg_temp.pushes(), '', 'and queue no pushes');

-- ---------------------------------------------------------------------------
-- complete_item
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format('select public.complete_item(%L, 2)', pg_temp.id('t1')),
  'P0001', 'not_owner', 'only the owner can complete an item');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.complete_item(%L, 1)', pg_temp.id('t1')),
  'P0001', 'stale_version', 'completing at an old version is stale_version');
select is((public.complete_item(pg_temp.id('t1'), 2)).state, 'completed', 'the owner completes their item');
select is(pg_temp.summary('t1'), 'completed owner=Bob proposed=- v3',
  'Assigned → Completed, and everyone can see who did it');
select is(pg_temp.events(), 'completed by Bob', 'completing writes one history row');
select is(pg_temp.pushes(), '', 'completing notifies nobody');

select throws_ok(format('select public.complete_item(%L, 3)', pg_temp.id('t1')),
  'P0001', 'invalid_state', 'a Completed item can''t be completed again');
select throws_ok(format('select public.cancel_item(%L, 3)', pg_temp.id('t1')),
  'P0001', 'invalid_state', 'a Completed item can''t be cancelled');
select throws_ok(format('select public.claim(%L, 3)', pg_temp.id('t1')),
  'P0001', 'invalid_state', 'a Completed item can''t be claimed');
select throws_ok(format('select public.assign(%L, 3, %L)', pg_temp.id('t1'), 'e0000000-0000-0000-0000-00000000000e'),
  'P0001', 'invalid_state', 'a Completed item can''t be assigned');
select throws_ok(format('select public.update_item(%L, 3, %L)', pg_temp.id('t1'), '{"title": "New"}'),
  'P0001', 'invalid_state', 'a Completed item can''t be edited');
select throws_ok(format('select public.withdraw_assignment(%L, 3)', pg_temp.id('t1')),
  'P0001', 'assignment_no_longer_available', 'a Completed item has no request to withdraw');

-- ---------------------------------------------------------------------------
-- accept, decline, withdraw and reassign (t2, Awaiting acceptance for Bob)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format('select public.accept_assignment(%L, 1)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available', 'you can''t accept someone else''s request');
select throws_ok(format('select public.decline_assignment(%L, 1)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available', 'or decline it');
select throws_ok(format('select public.complete_item(%L, 1)', pg_temp.id('t2')),
  'P0001', 'invalid_state', 'an Awaiting acceptance item can''t be completed');
select throws_ok(format('select public.claim(%L, 1)', pg_temp.id('t2')),
  'P0001', 'invalid_state', 'an Awaiting acceptance item can''t be claimed');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.decline_assignment(%L, 0)', pg_temp.id('t2')),
  'P0001', 'stale_version', 'answering at an old version is stale_version');
select is((public.decline_assignment(pg_temp.id('t2'), 1)).state, 'needs_someone', 'Bob declines');
select is(pg_temp.summary('t2'), 'needs_someone owner=- proposed=- v2', 'Awaiting acceptance → Needs someone');
select is(pg_temp.requests('t2'), 'declined Bob by Alice', 'the request is declined');
select is(pg_temp.events(), 'declined by Bob', 'declining writes one history row');
select is(pg_temp.pushes(), 'assignment_declined Alice', 'the person who asked is told');

select throws_ok(format('select public.accept_assignment(%L, 2)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available', 'a declined request can''t then be accepted');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.withdraw_assignment(%L, 2)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available', 'there''s nothing to withdraw on a Needs someone item');
select throws_ok(format('select public.assign(%L, 2, %L)', pg_temp.id('t2'), 'c0000000-0000-0000-0000-00000000000c'),
  'P0001', 'invalid_input', 'you can only assign members of your circle');
select throws_ok(format('select public.assign(%L, 1, %L)', pg_temp.id('t2'), 'b0000000-0000-0000-0000-00000000000b'),
  'P0001', 'stale_version', 'assigning at an old version is stale_version');

select is((public.assign(pg_temp.id('t2'), 2, 'b0000000-0000-0000-0000-00000000000b')).state,
  'awaiting_acceptance', 'Alice asks Bob again');
select is(pg_temp.summary('t2'), 'awaiting_acceptance owner=- proposed=Bob v3', 'Needs someone → Awaiting acceptance');
select is(pg_temp.events(), 'assigned by Alice', 'assigning writes one history row');
select is(pg_temp.pushes(), 'assignment_requested Bob', 'the assignee is asked');
select throws_ok(format('select public.assign(%L, 3, %L)', pg_temp.id('t2'), 'b0000000-0000-0000-0000-00000000000b'),
  'P0001', 'invalid_state', 'asking the same person twice is invalid_state');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select is((public.withdraw_assignment(pg_temp.id('t2'), 3)).state, 'needs_someone',
  'any member can withdraw a request');
select is(pg_temp.summary('t2'), 'needs_someone owner=- proposed=- v4', 'Awaiting acceptance → Needs someone');
select is(pg_temp.requests('t2'), 'declined Bob by Alice, withdrawn Bob by Alice', 'the request is withdrawn');
select is(pg_temp.events(), 'withdrawn by Erin', 'withdrawing writes one history row');
select is(pg_temp.pushes(), 'assignment_withdrawn Bob', 'the proposed assignee is told');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok(format('select public.assign(%L, 4, %L)', pg_temp.id('t2'), 'b0000000-0000-0000-0000-00000000000b'),
  'Alice asks Bob a third time');
select is(pg_temp.events(), 'assigned by Alice', 'one history row');
select is(pg_temp.pushes(), 'assignment_requested Bob', 'Bob is asked');

select is((public.assign(pg_temp.id('t2'), 5, 'e0000000-0000-0000-0000-00000000000e')).state,
  'awaiting_acceptance', 'Alice reassigns the request to Erin');
select is(pg_temp.summary('t2'), 'awaiting_acceptance owner=- proposed=Erin v6',
  'Awaiting acceptance → Awaiting acceptance for someone else');
select is(pg_temp.requests('t2'),
  'declined Bob by Alice, pending Erin by Alice, superseded Bob by Alice, withdrawn Bob by Alice',
  'the earlier request is superseded, leaving one pending');
select is(pg_temp.events(), 'assigned by Alice', 'reassigning writes one history row');
select is(pg_temp.pushes(), 'assignment_requested Erin, reassigned_away Bob',
  'the new assignee is asked and the old one told');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select throws_ok(format('select public.accept_assignment(%L, 5)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available',
  'accepting a superseded request is assignment_no_longer_available, not stale_version');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select is((public.accept_assignment(pg_temp.id('t2'), 6)).state, 'assigned', 'Erin accepts');
select is(pg_temp.summary('t2'), 'assigned owner=Erin proposed=- v7',
  'Awaiting acceptance → Assigned, with Erin the confirmed owner');
select is(pg_temp.requests('t2'),
  'accepted Erin by Alice, declined Bob by Alice, superseded Bob by Alice, withdrawn Bob by Alice',
  'the request is accepted');
select is(pg_temp.events(), 'accepted by Erin', 'accepting writes one history row');
select is(pg_temp.pushes(), 'assignment_accepted Alice', 'the person who asked is told');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select throws_ok(format('select public.assign(%L, 7, %L)', pg_temp.id('t2'), 'e0000000-0000-0000-0000-00000000000e'),
  'P0001', 'invalid_state', 'assigning the owner their own item is invalid_state');
select throws_ok(format('select public.withdraw_assignment(%L, 7)', pg_temp.id('t2')),
  'P0001', 'assignment_no_longer_available', 'an accepted request can''t be withdrawn');
select is((public.assign(pg_temp.id('t2'), 7, 'b0000000-0000-0000-0000-00000000000b')).state,
  'awaiting_acceptance', 'Alice reassigns Erin''s item to Bob');
select is(pg_temp.summary('t2'), 'awaiting_acceptance owner=- proposed=Bob v8',
  'Assigned → Awaiting acceptance for the new person; Erin is no longer the owner');
select is(pg_temp.events(), 'assigned by Alice', 'one history row');
select is(pg_temp.pushes(), 'assignment_requested Bob, reassigned_away Erin',
  'Bob is asked and Erin is told');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select lives_ok(format('select public.accept_assignment(%L, 8)', pg_temp.id('t2')), 'Bob accepts');
select is(pg_temp.events(), 'accepted by Bob', 'one history row');
select is(pg_temp.pushes(), 'assignment_accepted Alice', 'Alice is told');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select is((public.assign(pg_temp.id('t2'), 9, 'e0000000-0000-0000-0000-00000000000e')).state, 'assigned',
  'assigning yourself an Assigned item takes it over');
select is(pg_temp.summary('t2'), 'assigned owner=Erin proposed=- v10', 'BR-03: with no second acceptance');
select is(pg_temp.events(), 'claimed by Erin', 'one history row');
select is(pg_temp.pushes(), 'reassigned_away Bob', 'the previous owner is told');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is(pg_temp.summary('t4'), 'needs_someone owner=- proposed=- v1', 't4 Needs someone');
select is((public.assign(pg_temp.id('t4'), 1, 'b0000000-0000-0000-0000-00000000000b')).owner_id,
  'b0000000-0000-0000-0000-00000000000b'::uuid, 'assigning yourself a Needs someone item claims it');
select is(pg_temp.summary('t4'), 'assigned owner=Bob proposed=- v2', 'Needs someone → Assigned');
select is(pg_temp.requests('t4'), '', 'with no assignment request');
select is(pg_temp.events(), 'claimed by Bob', 'one history row');
select is(pg_temp.pushes(), '', 'and no pushes');

-- ---------------------------------------------------------------------------
-- update_item and BR-11 (t3, Assigned to Alice)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select is((public.update_item(pg_temp.id('t3'), 1,
  jsonb_build_object('starts_at', now() + interval '5 days'))).state, 'assigned',
  'the owner moves their own item');
select is(pg_temp.summary('t3'), 'assigned owner=Alice proposed=- v2',
  'BR-11: no re-confirmation when the owner changes the date');
select is(pg_temp.events(), 'updated by Alice', 'editing writes one history row');
select is(pg_temp.pushes(), '', 'and the owner isn''t told about their own change');

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is((public.update_item(pg_temp.id('t3'), 2,
  '{"title": "Physio at the clinic", "location": "Main St", "private_notes": "Ask about stretches"}')).title,
  'Physio at the clinic', 'Bob edits the title, location and notes');
select is(pg_temp.summary('t3'), 'assigned owner=Alice proposed=- v3',
  'a non-schedule edit keeps the owner');
select is((select e.data from public.activity_events e
           where e.item_id = pg_temp.id('t3') order by e.id desc limit 1),
  '{"fields": ["title", "location", "private_notes"]}'::jsonb, 'the history row lists what changed');
select is(pg_temp.events(), 'updated by Bob', 'one history row');
select is(pg_temp.pushes(), 'item_changed Alice', 'the owner is told');

select throws_ok(format('select public.update_item(%L, 2, %L)', pg_temp.id('t3'), '{"ends_at": null}'),
  'P0001', 'stale_version', 'editing at an old version is stale_version');
select throws_ok(format('select public.update_item(%L, 3, %L)', pg_temp.id('t3'), '{"colour": "red"}'),
  'P0001', 'invalid_input', 'unknown fields are refused');
select throws_ok(format('select public.update_item(%L, 3, %L)', pg_temp.id('t3'), '{"starts_at": "soon"}'),
  'P0001', 'invalid_input', 'a time must be a time');
select throws_ok(format('select public.update_item(%L, 3, %L)', pg_temp.id('t3'), '{"title": " "}'),
  'P0001', 'invalid_input', 'the title can''t be cleared');
select throws_ok(format('select public.update_item(%L, 3, %L)', pg_temp.id('t3'), '[]'),
  'P0001', 'invalid_input', 'the patch is an object');

select is((public.update_item(pg_temp.id('t3'), 3, '{"title": "Physio at the clinic"}')).version, 3,
  'an edit that changes nothing keeps the version');
select is(pg_temp.events(), '', 'and writes no history');

select is((public.update_item(pg_temp.id('t3'), 3,
  jsonb_build_object('ends_at', now() + interval '5 days 1 hour'))).state, 'awaiting_acceptance',
  'BR-11: Bob changes the time of Alice''s item');
select is(pg_temp.summary('t3'), 'awaiting_acceptance owner=- proposed=Alice v4',
  'it returns to Awaiting acceptance for the same person');
select is(pg_temp.requests('t3'), 'pending Alice by Bob', 'with a new pending request for her');
select is((select e.data ->> 'reconfirm_assignee_id' from public.activity_events e
           where e.item_id = pg_temp.id('t3') order by e.id desc limit 1),
  'a0000000-0000-0000-0000-00000000000a', 'the history row records who must re-confirm');
select is(pg_temp.events(), 'updated by Bob', 'one history row');
select is(pg_temp.pushes(), 'reconfirm_requested Alice', 'and she''s asked to re-confirm');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok(format('select public.accept_assignment(%L, 4)', pg_temp.id('t3')), 'Alice re-confirms');
select is(pg_temp.summary('t3'), 'assigned owner=Alice proposed=- v5', 'and owns it again');
select is(pg_temp.events(), 'accepted by Alice', 'one history row');
select is(pg_temp.pushes(), 'assignment_accepted Bob', 'Bob is told');

-- ---------------------------------------------------------------------------
-- cancel_item from every open state
-- ---------------------------------------------------------------------------
select set_config('test.t5', public.create_item('task', 'Groceries', now() + interval '1 day')::text, true);
select set_config('test.t6', public.create_item('task', 'Laundry', now() + interval '1 day',
  assignee_id => 'b0000000-0000-0000-0000-00000000000b')::text, true);
select set_config('test.t7', public.create_item('task', 'Pharmacy run', now() + interval '1 day')::text, true);
select pg_temp.events();
select pg_temp.pushes();

-- t7 Needs coverage, owned by Bob (coverage RPCs are task 3.1).
reset role;
update public.items i set state = 'needs_coverage', owner_id = 'b0000000-0000-0000-0000-00000000000b'
where i.id = pg_temp.id('t7');
insert into public.coverage_requests (circle_id, item_id, requester_id)
values ('10000000-0000-0000-0000-000000000001', pg_temp.id('t7'), 'b0000000-0000-0000-0000-00000000000b');

select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select throws_ok(format('select public.claim(%L, 1)', pg_temp.id('t7')),
  'P0001', 'already_claimed', 'a Needs coverage item has an owner, so it can''t be claimed');
select throws_ok(format('select public.complete_item(%L, 1)', pg_temp.id('t7')),
  'P0001', 'invalid_state', 'a Needs coverage item can''t be completed');
select throws_ok(format('select public.assign(%L, 1, %L)', pg_temp.id('t7'), 'e0000000-0000-0000-0000-00000000000e'),
  'P0001', 'invalid_state', 'a Needs coverage item can''t be assigned');

select throws_ok(format('select public.cancel_item(%L, 0)', pg_temp.id('t5')),
  'P0001', 'stale_version', 'cancelling at an old version is stale_version');
select is((public.cancel_item(pg_temp.id('t5'), 1)).state, 'cancelled', 'Needs someone → Cancelled');
select is(pg_temp.events(), 'cancelled by Erin', 'cancelling writes one history row');
select is(pg_temp.pushes(), '', 'nobody had it, so nobody is told');

select is((public.cancel_item(pg_temp.id('t6'), 1)).state, 'cancelled', 'Awaiting acceptance → Cancelled');
select is(pg_temp.requests('t6'), 'withdrawn Bob by Alice', 'the pending request is resolved');
select is(pg_temp.events(), 'cancelled by Erin', 'one history row');
select is(pg_temp.pushes(), 'item_cancelled Bob', 'the proposed assignee is told');

select is((public.cancel_item(pg_temp.id('t3'), 5)).state, 'cancelled', 'Assigned → Cancelled');
select is(pg_temp.events(), 'cancelled by Erin', 'one history row');
select is(pg_temp.pushes(), 'item_cancelled Alice', 'the owner is told');

select is((public.cancel_item(pg_temp.id('t7'), 1)).state, 'cancelled', 'Needs coverage → Cancelled');
select is((select c.status from public.coverage_requests c where c.item_id = pg_temp.id('t7')),
  'cancelled', 'the open coverage request is cancelled');
select is(pg_temp.events(), 'cancelled by Erin', 'one history row');
select is(pg_temp.pushes(), 'item_cancelled Bob', 'the owner is told');

select throws_ok(format('select public.cancel_item(%L, 2)', pg_temp.id('t7')),
  'P0001', 'invalid_state', 'a Cancelled item can''t be cancelled again');
select throws_ok(format('select public.update_item(%L, 2, %L)', pg_temp.id('t7'), '{"title": "x"}'),
  'P0001', 'invalid_state', 'a Cancelled item can''t be edited');

-- ---------------------------------------------------------------------------
-- Non-members can't touch circle X's items
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select throws_ok(format(s.sql, pg_temp.id('t2')), 'P0001', 'not_member',
  format('a member of another circle can''t call %s', s.fn))
from (values
  ('update_item', 'select public.update_item(%L, 10, ''{"title": "x"}'')'),
  ('assign', 'select public.assign(%L, 10, ''c0000000-0000-0000-0000-00000000000c'')'),
  ('accept_assignment', 'select public.accept_assignment(%L, 10)'),
  ('decline_assignment', 'select public.decline_assignment(%L, 10)'),
  ('withdraw_assignment', 'select public.withdraw_assignment(%L, 10)'),
  ('claim', 'select public.claim(%L, 10)'),
  ('complete_item', 'select public.complete_item(%L, 10)'),
  ('cancel_item', 'select public.cancel_item(%L, 10)')
) as s(fn, sql);

select pg_temp.sign_in_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok(format('select public.claim(%L, 10)', pg_temp.id('t2')), 'P0001', 'not_member',
  'someone in no circle can''t claim an item');
select is(pg_temp.summary('t2'), 'assigned owner=Erin proposed=- v10', 'and the item is untouched');

-- ---------------------------------------------------------------------------
-- Outbox payloads are privacy-safe (ADR-010)
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

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.lock_item(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.is_circle_member(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.name_detail(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.log_item_event(public.items, uuid, text, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.queue_push(public.items, uuid, text, uuid[])', 'execute')
    and not has_function_privilege('authenticated', 'public.check_item_fields(text, timestamptz, timestamptz, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.lock_own_pending_request(uuid)', 'execute'),
  'internal helpers can''t be called from the app'
);
select ok(
  has_function_privilege('authenticated', 'public.claim(uuid, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.update_item(uuid, integer, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.claim(uuid, integer)', 'execute'),
  'signed-in members can call the item RPCs; signed-out visitors can''t'
);

select * from finish();
rollback;
