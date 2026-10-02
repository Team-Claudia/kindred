-- Task 3.4: the personal calendar feed (ADR-008, US 5.2, US 8.3).
--
-- People: Alice and Bob are in circle X (Dad). Carol is in no circle.
begin;
select plan(24);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('c0000000-0000-0000-0000-00000000000c'); -- Carol

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');

-- Act as a signed-in user. auth.uid() reads the JWT claims.
create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- The titles in a member's feed, in feed order, joined with commas.
create function pg_temp.feed_titles(person uuid) returns text language sql security definer as $$
  select coalesce(string_agg(e ->> 'title', ', ' order by n), '')
  from jsonb_array_elements(
    public.calendar_feed_for_token(
      (select cs.feed_token from public.calendar_settings cs where cs.user_id = person)
    ) -> 'items'
  ) with ordinality as x(e, n)
$$;

-- Items, all in circle X. Alice owns or is proposed for most of them.
insert into public.items (circle_id, kind, title, starts_at, ends_at, location, private_notes, state, owner_id, proposed_assignee_id)
values
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Assigned appt', now() + interval '1 day', now() + interval '1 day 1 hour', 'Clinic', 'Secret note', 'assigned', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Needs coverage appt', now() + interval '2 days', null, null, null, 'needs_coverage', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Awaiting appt', now() + interval '3 days', null, null, null, 'awaiting_acceptance', null, 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Completed appt', now() - interval '1 day', null, null, null, 'completed', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Cancelled appt', now() + interval '4 days', null, null, null, 'cancelled', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Needs someone appt', now() + interval '5 days', null, null, null, 'needs_someone', null, null),
  ('10000000-0000-0000-0000-000000000001', 'task', 'Assigned task', now() + interval '6 days', null, null, null, 'assigned', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Long ago appt', now() - interval '60 days', null, null, null, 'assigned', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Far future appt', now() + interval '2 years', null, null, null, 'assigned', 'a0000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000001', 'appointment', 'Bob appt', now() + interval '7 days', null, null, null, 'assigned', 'b0000000-0000-0000-0000-00000000000b', null);

-- ---------------------------------------------------------------------------
-- calendar_feed and set_calendar_feed_tasks
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select 1 from public.calendar_settings $$,
  'nobody has calendar settings yet'
);

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
create temp table alice_first on commit drop as select * from public.calendar_feed();
create temp table alice_again on commit drop as select * from public.calendar_feed();
reset role;

select ok(
  (select token ~ '^[0-9a-f]{48}$' and feed_tasks = false from alice_first),
  'calendar_feed creates the caller''s row: a 48-character hex token, tasks off'
);

select is(
  (select token from alice_again),
  (select token from alice_first),
  'calling it again returns the same token'
);

select is(
  (select feed_token from public.calendar_settings where user_id = 'a0000000-0000-0000-0000-00000000000a'),
  (select token from alice_first),
  'the token is the one stored for the caller'
);

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
create temp table bob_feed on commit drop as select * from public.calendar_feed();
reset role;

select isnt(
  (select token from bob_feed),
  (select token from alice_first),
  'each member gets their own token'
);

select is(
  (select count(*)::int from public.calendar_settings),
  2,
  'one row per member who asked'
);

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select is(
  (select array_agg(token) from public.calendar_feed()),
  (select array_agg(token) from bob_feed),
  'a member only ever gets their own token'
);

select throws_ok(
  $$ select public.calendar_feed_for_token('x') $$,
  '42501', null,
  'members cannot read a feed by token'
);

select throws_ok(
  $$ insert into public.calendar_settings (user_id) values ('c0000000-0000-0000-0000-00000000000c') $$,
  '42501', null,
  'the app cannot write calendar_settings directly'
);
reset role;

select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select ok(
  (select feed_tasks from public.set_calendar_feed_tasks(true)),
  'set_calendar_feed_tasks creates the row if needed and turns tasks on'
);
select throws_ok(
  $$ select * from public.set_calendar_feed_tasks(null) $$,
  'P0001', 'invalid_input',
  'tasks must be on or off'
);
reset role;

select ok(
  (select feed_tasks from public.calendar_settings where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  'the setting is saved'
);

set local role anon;
select throws_ok(
  $$ select * from public.calendar_feed() $$,
  '42501', null,
  'signed-out visitors cannot get a feed token'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.calendar_feed()', 'execute')
    and has_function_privilege('authenticated', 'public.set_calendar_feed_tasks(boolean)', 'execute')
    and not has_function_privilege('anon', 'public.calendar_feed()', 'execute')
    and not has_function_privilege('anon', 'public.set_calendar_feed_tasks(boolean)', 'execute')
    and not has_function_privilege('anon', 'public.calendar_feed_for_token(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.calendar_feed_for_token(text)', 'execute')
    and has_function_privilege('service_role', 'public.calendar_feed_for_token(text)', 'execute'),
  'only the service role can read a feed by token'
);

-- ---------------------------------------------------------------------------
-- calendar_feed_for_token
-- ---------------------------------------------------------------------------

select is(
  public.calendar_feed_for_token('0000000000000000000000000000000000000000000000ff'),
  null,
  'an unknown token returns null'
);

select is(
  public.calendar_feed_for_token(null),
  null,
  'no token returns null'
);

select is(
  (select public.calendar_feed_for_token(token) - 'items' from alice_first),
  '{"care_recipient_name": "Dad", "time_zone": "America/Toronto"}'::jsonb,
  'the feed carries the care recipient''s name and the circle''s time zone'
);

select is(
  pg_temp.feed_titles('a0000000-0000-0000-0000-00000000000a'),
  'Assigned appt, Needs coverage appt',
  'only appointments the member owns and has accepted, within the window'
);

select is(
  (select string_agg(k, ',' order by k)
   from alice_first,
        jsonb_array_elements(public.calendar_feed_for_token(alice_first.token) -> 'items') e,
        jsonb_object_keys(e) k
   where e ->> 'title' = 'Assigned appt'),
  'ends_at,id,kind,starts_at,state,title,updated_at,version',
  'no notes or location in the feed'
);

update public.calendar_settings set feed_tasks = true
where user_id = 'a0000000-0000-0000-0000-00000000000a';

select is(
  pg_temp.feed_titles('a0000000-0000-0000-0000-00000000000a'),
  'Assigned appt, Needs coverage appt, Assigned task',
  'tasks are included once the member turns them on'
);

update public.calendar_settings set feed_appointments = false
where user_id = 'a0000000-0000-0000-0000-00000000000a';

select is(
  pg_temp.feed_titles('a0000000-0000-0000-0000-00000000000a'),
  'Assigned task',
  'appointments are left out if the member turns them off'
);

update public.calendar_settings set feed_appointments = true, feed_tasks = false
where user_id = 'a0000000-0000-0000-0000-00000000000a';

-- A handoff: Bob takes over the coverage appointment (US 8.3).
update public.items set owner_id = 'b0000000-0000-0000-0000-00000000000b', state = 'assigned'
where title = 'Needs coverage appt';

select is(
  pg_temp.feed_titles('a0000000-0000-0000-0000-00000000000a') || ' | ' || pg_temp.feed_titles('b0000000-0000-0000-0000-00000000000b'),
  'Assigned appt | Needs coverage appt, Bob appt',
  'after a handoff the item leaves the old owner''s feed and joins the new owner''s'
);

update public.items set state = 'cancelled' where title = 'Assigned appt';

select is(
  pg_temp.feed_titles('a0000000-0000-0000-0000-00000000000a'),
  '',
  'a cancelled item leaves the feed'
);

select is(
  (select public.calendar_feed_for_token(feed_token)
   from public.calendar_settings where user_id = 'c0000000-0000-0000-0000-00000000000c'),
  '{"care_recipient_name": null, "time_zone": "America/Vancouver", "items": []}'::jsonb,
  'a member with no circle gets an empty feed'
);

select * from finish();
rollback;
