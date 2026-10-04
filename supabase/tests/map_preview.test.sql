-- Task 4.5h: map preview (plan §4.4, ADR-017). Setting or changing an
-- appointment's location queues one geocode job per place, never for tasks or
-- unchanged locations; store_geocode fills in the coordinates.
--
-- People: Alice and Bob are in circle X; Erin is alone in circle Z.
begin;
select plan(34);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('e0000000-0000-0000-0000-00000000000e'); -- Erin

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto'),
  ('30000000-0000-0000-0000-000000000003', 'Mom', 'America/Toronto');

insert into public.circle_members (circle_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'member'),
  ('30000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e', 'admin');

-- How many pg_net requests were queued before this test.
create temp table queued_before as select count(*) as n from net.http_request_queue;

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

-- Creates an item as the signed-in member and remembers its ID as `name`.
create function pg_temp.make(name text, kind text, location text) returns uuid language sql as $$
  select set_config('test.' || name, public.create_item(
    kind, 'Item ' || name, now() + interval '2 days', location => location)::text, true)::uuid
$$;

-- Pending geocode jobs for an item.
create function pg_temp.jobs(name text) returns integer language sql security definer as $$
  select count(*)::integer from public.outbox o
  where o.kind = 'geocode' and o.status = 'pending' and o.payload ->> 'item_id' = pg_temp.id(name)::text
$$;

-- Pending geocode jobs in circle X.
create function pg_temp.circle_jobs() returns integer language sql security definer as $$
  select count(*)::integer from public.outbox o
  where o.kind = 'geocode' and o.status = 'pending'
    and o.circle_id = '10000000-0000-0000-0000-000000000001'
$$;

-- An item's coordinates as "lat,lng", or "none".
create function pg_temp.coords(name text) returns text language sql security definer as $$
  select coalesce(i.location_lat || ',' || i.location_lng, 'none')
  from public.items i where i.id = pg_temp.id(name)
$$;

create function pg_temp.version(name text) returns integer language sql security definer as $$
  select i.version from public.items i where i.id = pg_temp.id(name)
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select has_function('public', 'store_geocode', array['uuid', 'text', 'double precision', 'double precision']);
select ok(has_function_privilege('service_role', 'public.store_geocode(uuid, text, double precision, double precision)', 'execute'),
  'the worker can store coordinates');
select ok(not has_function_privilege('authenticated', 'public.store_geocode(uuid, text, double precision, double precision)', 'execute'),
  'signed-in members cannot store coordinates');
select ok(not has_function_privilege('anon', 'public.store_geocode(uuid, text, double precision, double precision)', 'execute'),
  'signed-out visitors cannot store coordinates');
select ok(not has_function_privilege('authenticated', 'public.items_geocode_location()', 'execute'),
  'the trigger function is internal');

-- ---------------------------------------------------------------------------
-- Queuing
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select pg_temp.make('clinic', 'appointment', '  123 Main St, Toronto  ');
select pg_temp.make('task', 'task', '123 Main St, Toronto');
select pg_temp.make('nowhere', 'appointment', null);

select is(pg_temp.jobs('clinic'), 1, 'creating an appointment with a location queues a geocode job');
select is(pg_temp.coords('clinic'), 'none', 'with no coordinates until it runs');
select is(pg_temp.jobs('task'), 0, 'a task is never geocoded');
select is(pg_temp.jobs('nowhere'), 0, 'nor an appointment with no location');

reset role;
select is(
  (select array_agg(k order by k) from public.outbox o, jsonb_object_keys(o.payload) k
   where o.kind = 'geocode' and o.payload ->> 'item_id' = pg_temp.id('clinic')::text),
  array['item_id'], 'the job holds the item ID only, never the location text'
);
select is(
  (select o.circle_id from public.outbox o
   where o.kind = 'geocode' and o.payload ->> 'item_id' = pg_temp.id('clinic')::text),
  '10000000-0000-0000-0000-000000000001'::uuid, 'and the circle, so it goes when the circle does'
);

-- A second appointment at the same place while the first job waits.
select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select pg_temp.make('clinic2', 'appointment', '123 Main St, Toronto');
select is(pg_temp.jobs('clinic2'), 0, 'the same place while its job waits queues no second job');

-- Editing without changing the location.
select public.update_item(pg_temp.id('clinic'), pg_temp.version('clinic'), '{"title": "Cardiology"}');
select public.update_item(pg_temp.id('clinic'), pg_temp.version('clinic'), '{"location": "123 Main St, Toronto"}');
select is(pg_temp.circle_jobs(), 1, 'editing the title, or saving the same location, queues nothing');

-- A daily series at one place.
select set_config('test.physio', public.create_item(
  'appointment', 'Physio', now() + interval '1 day', location => 'Physio clinic',
  repeat => 'daily', until => now() + interval '5 days 1 hour')::text, true);
reset role;
select is(
  (select count(*)::integer from public.items i
   where i.series_id = (select series_id from public.items where id = pg_temp.id('physio'))),
  5, 'the series has 5 occurrences'
);
select is(
  (select count(*)::integer from public.outbox o join public.items i on i.id = (o.payload ->> 'item_id')::uuid
   where o.kind = 'geocode' and o.status = 'pending' and i.location = 'Physio clinic'),
  1, 'but only one geocode job'
);

-- The occurrence that job is for moves elsewhere before it runs.
select set_config('test.physio_job', (
  select o.payload ->> 'item_id' from public.outbox o join public.items i on i.id = (o.payload ->> 'item_id')::uuid
  where o.kind = 'geocode' and o.status = 'pending' and i.location = 'Physio clinic'), true);
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.update_item(pg_temp.id('physio_job'), pg_temp.version('physio_job'), '{"location": "Home"}');
reset role;
select is(
  (select count(*)::integer from public.outbox o join public.items i on i.id = (o.payload ->> 'item_id')::uuid
   where o.kind = 'geocode' and o.status = 'pending' and i.location = 'Physio clinic'
     and i.id <> pg_temp.id('physio_job')),
  1, 'its job passes to another occurrence still at the clinic'
);
select is(pg_temp.jobs('physio_job'), 1, 'and it gets its own for the new place');

-- ---------------------------------------------------------------------------
-- Storing the result
-- ---------------------------------------------------------------------------

set local role service_role;
select throws_ok(
  format('select public.store_geocode(%L, %L, 91, 0)', pg_temp.id('clinic'), '123 Main St, Toronto'),
  'invalid_input', 'a latitude out of range is refused'
);
select is(
  public.store_geocode(pg_temp.id('clinic'), 'Somewhere else', 43.65, -79.38),
  0, 'a location that no longer matches stores nothing'
);
select is(
  public.store_geocode(pg_temp.id('clinic'), '123 Main St, Toronto', 43.65, -79.38),
  2, 'the found place is stored on both appointments there'
);
reset role;
select is(pg_temp.coords('clinic') || ' ' || pg_temp.coords('clinic2'), '43.65,-79.38 43.65,-79.38',
  'each has the coordinates');
select is(pg_temp.coords('task'), 'none', 'the task at that address does not');
select is(pg_temp.version('clinic2'), 1, 'storing coordinates is not an edit');

-- Once found, the same place is reused.
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select pg_temp.make('clinic3', 'appointment', '123 Main St, Toronto');
select is(pg_temp.coords('clinic3'), '43.65,-79.38', 'a new appointment at a found place reuses its coordinates');
select is(pg_temp.jobs('clinic3'), 0, 'without a geocode job');

-- But not from another circle.
select pg_temp.sign_in_as('e0000000-0000-0000-0000-00000000000e');
select pg_temp.make('erin', 'appointment', '123 Main St, Toronto');
select is(pg_temp.coords('erin'), 'none', 'another circle''s coordinates are not reused');
select is(pg_temp.jobs('erin'), 1, 'it is geocoded on its own');

-- Changing the location.
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.update_item(pg_temp.id('clinic'), pg_temp.version('clinic'), '{"location": "Dad''s house"}');
select is(pg_temp.coords('clinic'), 'none', 'changing the location clears the coordinates');
select is(pg_temp.jobs('clinic'), 1, 'and queues a geocode job for the new one');
select public.update_item(pg_temp.id('clinic2'), pg_temp.version('clinic2'), '{"location": ""}');
select is(pg_temp.coords('clinic2') || ' ' || pg_temp.jobs('clinic2'), 'none 0',
  'removing the location clears them and queues nothing');

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

reset role;
update public.outbox set status = 'done' where kind <> 'geocode' and status in ('pending', 'sending');
create temp table claimed as select * from public.claim_outbox_jobs(50);
select ok(
  (select count(*) from claimed where kind = 'geocode') > 0
    and not exists (select 1 from public.outbox where kind = 'geocode' and status = 'pending'),
  'the worker claims geocode jobs'
);
select ok(
  pg_get_functiondef('public.claim_outbox_jobs(integer)'::regprocedure)
    ~ $re$'push', 'reminder', 'overdue', 'weekly_summary', 'geocode'$re$,
  'and still every other kind'
);

select is(
  (select count(*) from net.http_request_queue),
  (select n from queued_before),
  'without the Vault values, geocode jobs call nothing'
);
select vault.create_secret('https://project.example.test/functions/v1/outbox-worker', 'outbox_worker_url');
select vault.create_secret('test-secret', 'outbox_worker_secret');
insert into public.outbox (circle_id, kind, payload)
values ('10000000-0000-0000-0000-000000000001', 'geocode', jsonb_build_object('item_id', pg_temp.id('clinic')));
select is(
  (select count(*) from net.http_request_queue),
  (select n + 1 from queued_before),
  'a new geocode job calls the worker straight away'
);

select * from finish();
rollback;
