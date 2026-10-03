-- Task 4.1: post_update (PRD US 10.1, plan §4.2, §4.4).
--
-- People: Alice, Bob and Erin are in circle X. Carol is in circle Y. Dave
-- isn't in any circle.
begin;
select plan(24);

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

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.id(name text) returns uuid language sql as $$
  select current_setting('test.' || name)::uuid
$$;

create function pg_temp.update_count() returns bigint language sql security definer as $$
  select count(*) from public.updates
$$;

create function pg_temp.event_count() returns bigint language sql security definer as $$
  select count(*) from public.activity_events
$$;

create function pg_temp.outbox_count() returns bigint language sql security definer as $$
  select count(*) from public.outbox
$$;

-- An update at a glance: "<author first name> <circle name> [<item title>]: <body>".
create function pg_temp.update_row(name text) returns text language sql security definer as $$
  select coalesce(split_part(p.display_name, ' ', 1), '-') || ' ' || c.care_recipient_name
    || coalesce(' [' || i.title || ']', '') || ': ' || u.body
  from public.updates u
  join public.circles c on c.id = u.circle_id
  left join public.profiles p on p.id = u.author_id
  left join public.items i on i.id = u.item_id
  where u.id = pg_temp.id(name)
$$;

-- The update's history row: "<type> by <first name> item=<title or -> data=<data>".
create function pg_temp.update_event(name text) returns text language sql security definer as $$
  select e.type || ' by ' || coalesce(split_part(p.display_name, ' ', 1), '-')
    || ' item=' || coalesce(i.title, '-')
    || case when e.circle_id is distinct from u.circle_id then ' (wrong circle!)' else '' end
  from public.activity_events e
  join public.updates u on u.id = pg_temp.id(name)
  left join public.profiles p on p.id = e.actor_id
  left join public.items i on i.id = e.item_id
  where e.data ->> 'update_id' = pg_temp.id(name)::text
$$;

-- The update's push jobs: "<recipient first name>", by name.
create function pg_temp.push_recipients(name text) returns text language sql security definer as $$
  select coalesce(string_agg(coalesce(split_part(p.display_name, ' ', 1), '-'), ', ' order by p.display_name), '')
  from public.outbox o
  left join public.profiles p on p.id = (o.payload ->> 'recipient_id')::uuid
  where o.payload ->> 'update_id' = pg_temp.id(name)::text
$$;

-- Whether every push job for the update has exactly the expected shape.
create function pg_temp.pushes_ok(name text, item uuid) returns boolean language sql security definer as $$
  select bool_and(
    o.kind = 'push'
    and o.status = 'pending'
    and o.circle_id = u.circle_id
    and o.payload ->> 'event' = 'update_posted'
    and o.payload ->> 'actor_id' = u.author_id::text
    and (o.payload ->> 'item_id') is not distinct from item::text
    and (select array_agg(k order by k) from jsonb_object_keys(o.payload) as k)
      = case when item is null
          then array['actor_id', 'event', 'recipient_id', 'update_id']
          else array['actor_id', 'event', 'item_id', 'recipient_id', 'update_id']
        end
  )
  from public.outbox o
  join public.updates u on u.id = pg_temp.id(name)
  where o.payload ->> 'update_id' = pg_temp.id(name)::text
$$;

-- Whether no outbox payload mentions the update text or the item title.
create function pg_temp.no_text_in_outbox() returns boolean language sql security definer as $$
  select not exists (
    select 1 from public.outbox o
    where o.payload::text ilike '%cardiology%' or o.payload::text ilike '%six weeks%'
  )
$$;

-- ---------------------------------------------------------------------------
-- Setup: an appointment in each circle.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.appt', public.create_item('appointment', 'Cardiology', now() + interval '2 days')::text, true);
select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select set_config('test.other_appt', public.create_item('appointment', 'Dentist', now() + interval '2 days')::text, true);

-- ---------------------------------------------------------------------------
-- An unlinked update
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select set_config('test.u1', public.post_update('  Dad slept well and ate breakfast.  ')::text, true);

select is(pg_temp.update_row('u1'), 'Bob Dad: Dad slept well and ate breakfast.',
  'a member posts an update to their circle, as its author, with the body trimmed');
select is(pg_temp.update_event('u1'), 'update_posted by Bob item=-',
  'it writes one update_posted history row with the update_id and no item');
select is(pg_temp.push_recipients('u1'), 'Alice, Erin',
  'it queues one push for every other member, not the author');
select ok(pg_temp.pushes_ok('u1', null),
  'each push is a pending update_posted job with IDs only, and no item_id when unlinked');

-- ---------------------------------------------------------------------------
-- An update linked to an item
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.u2', public.post_update('Back from cardiology, next visit in six weeks', pg_temp.id('appt'))::text, true);

select is(pg_temp.update_row('u2'), 'Alice Dad [Cardiology]: Back from cardiology, next visit in six weeks',
  'an update can be linked to an item in the circle');
select is(pg_temp.update_event('u2'), 'update_posted by Alice item=Cardiology',
  'its history row carries the item');
select is(pg_temp.push_recipients('u2'), 'Bob, Erin',
  'every other member is pushed');
select ok(pg_temp.pushes_ok('u2', pg_temp.id('appt')),
  'the push payload carries the item_id, and still no text');
select ok(pg_temp.no_text_in_outbox(),
  'no push payload holds the update text or the item title (ADR-010)');

-- Members of the circle can read it; others can't.
select is((select count(*) from public.updates where id = pg_temp.id('u2')), 1::bigint,
  'members can read the update');
select pg_temp.sign_in_as('c0000000-0000-0000-0000-00000000000c');
select is((select count(*) from public.updates where id = pg_temp.id('u2')), 0::bigint,
  'another circle''s member can''t');

-- ---------------------------------------------------------------------------
-- Errors. Nothing is written by a failed call.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select set_config('test.updates_before', pg_temp.update_count()::text, true);
select set_config('test.events_before', pg_temp.event_count()::text, true);
select set_config('test.outbox_before', pg_temp.outbox_count()::text, true);

select throws_ok($$ select public.post_update('') $$,
  'P0001', 'invalid_input', 'an empty body raises invalid_input');
select throws_ok($$ select public.post_update('   ') $$,
  'P0001', 'invalid_input', 'a blank body raises invalid_input');
select throws_ok(format('select public.post_update(%L)', E'\n\t \r\n'),
  'P0001', 'invalid_input', 'a body of only newlines and tabs raises invalid_input');
select throws_ok($$ select public.post_update(null) $$,
  'P0001', 'invalid_input', 'a missing body raises invalid_input');
select throws_ok(format('select public.post_update(%L)', repeat('a', 2001)),
  'P0001', 'invalid_input', 'a body over 2,000 characters raises invalid_input');
select lives_ok(format('select public.post_update(%L)', repeat('a', 2000)),
  'a body of exactly 2,000 characters is fine');
select set_config('test.updates_before', pg_temp.update_count()::text, true);
select set_config('test.events_before', pg_temp.event_count()::text, true);
select set_config('test.outbox_before', pg_temp.outbox_count()::text, true);

select throws_ok(format('select public.post_update(%L, %L)', 'Done', pg_temp.id('other_appt')),
  'P0001', 'invalid_input', 'an item in another circle raises invalid_input');
select throws_ok(format('select public.post_update(%L, %L)', 'Done', gen_random_uuid()),
  'P0001', 'invalid_input', 'an item that doesn''t exist raises invalid_input');

select pg_temp.sign_in_as('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.post_update('Hello') $$,
  'P0001', 'not_member', 'someone outside any circle gets not_member');

select is(pg_temp.update_count(), current_setting('test.updates_before')::bigint,
  'failed calls write no update');
select is(pg_temp.event_count(), current_setting('test.events_before')::bigint,
  'or history');
select is(pg_temp.outbox_count(), current_setting('test.outbox_before')::bigint,
  'or pushes');

-- ---------------------------------------------------------------------------
-- Who can call it
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.post_update(text, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.post_update(text, uuid)', 'execute'),
  'signed-in members can call post_update; signed-out visitors can''t'
);

select * from finish();
rollback;
