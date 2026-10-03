-- Task 4.7: build_sample_circle() builds the sample circle (docs/sample-data.md).
--
-- It builds once, then again with a demo guest in the circle, and checks the
-- second run leaves one sample circle with the same contents, keeps the guest
-- and leaves another circle alone.
begin;
select plan(26);

create function pg_temp.sample() returns uuid language sql as $$
  select '5a3b1e00-0000-4000-8000-000000000100'::uuid
$$;

-- The circle's contents at a glance, to compare one build with the next.
create function pg_temp.fingerprint() returns text language sql as $$
  select concat_ws(' | ',
    'circles ' || (select count(*) from public.circles c where c.id = pg_temp.sample()),
    'members ' || (select count(*) from public.circle_members m where m.circle_id = pg_temp.sample()),
    'items ' || (select string_agg(s.state || '=' || s.n, ',' order by s.state)
                 from (select i.state, count(*) n from public.items i
                       where i.circle_id = pg_temp.sample() group by i.state) s),
    'assignment ' || (select count(*) from public.assignment_requests r where r.circle_id = pg_temp.sample()),
    'coverage ' || (select count(*) from public.coverage_requests r where r.circle_id = pg_temp.sample()),
    'updates ' || (select count(*) from public.updates u where u.circle_id = pg_temp.sample()),
    'events ' || (select count(*) from public.activity_events e where e.circle_id = pg_temp.sample())
  )
$$;

-- Another circle, which a rebuild must not touch.
insert into auth.users (id) values ('a0000000-0000-0000-0000-00000000000a');
insert into public.circles (id, care_recipient_name) values ('10000000-0000-0000-0000-000000000001', 'Dad');
insert into public.circle_members (circle_id, user_id)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a');
insert into public.items (circle_id, kind, title, starts_at)
values ('10000000-0000-0000-0000-000000000001', 'task', 'Laundry', now());

-- ---------------------------------------------------------------------------
-- First build
-- ---------------------------------------------------------------------------
select is(public.build_sample_circle(), pg_temp.sample(), 'returns the sample circle''s fixed ID');

select results_eq(
  $$ select c.care_recipient_name, c.time_zone from public.circles c where c.id = pg_temp.sample() $$,
  $$ values ('Mom'::text, 'America/Vancouver'::text) $$,
  'the circle is for Mom, on America/Vancouver time'
);

select results_eq(
  $$ select p.display_name, m.role from public.circle_members m
     join public.profiles p on p.id = m.user_id
     where m.circle_id = pg_temp.sample() order by p.display_name $$,
  $$ values ('Daniel Hart'::text, 'member'::text), ('Maya Hart', 'admin'), ('Priya Hart', 'member') $$,
  'Maya (admin), Daniel and Priya are its members, with profiles from handle_new_user'
);

select ok(
  (select bool_and(u.email like '%@example.invalid' and u.encrypted_password = '' and u.email_confirmed_at is null)
   from auth.users u join public.circle_members m on m.user_id = u.id
   where m.circle_id = pg_temp.sample())
  and not exists (
    select 1 from auth.identities i join public.circle_members m on m.user_id = i.user_id
    where m.circle_id = pg_temp.sample()
  ),
  'the sample people have @example.invalid addresses, no password and no identity, so nobody can sign in as them'
);

select is(
  (select count(*)::integer from public.items i where i.circle_id = pg_temp.sample()),
  16,
  '16 items'
);

select set_eq(
  $$ select distinct i.state from public.items i where i.circle_id = pg_temp.sample() $$,
  array['needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage', 'completed', 'cancelled'],
  'items in every state'
);

select ok(
  (select count(*) from public.items i
   where i.circle_id = pg_temp.sample() and i.state = 'needs_someone') >= 5,
  'at least 5 Needs someone items for visitors to claim'
);

select ok(
  exists (select 1 from public.items i
          where i.circle_id = pg_temp.sample() and i.state = 'assigned' and i.starts_at < now()),
  'an Assigned item is Overdue'
);

select is(
  public.coverage_used('5a3b1e00-0000-4000-8000-000000000001', pg_temp.sample(), now()),
  1,
  'Maya has used one coverage request this month'
);

select ok(
  exists (select 1 from public.items i
          where i.circle_id = pg_temp.sample() and i.kind = 'appointment' and i.state = 'assigned'
            and i.owner_id = '5a3b1e00-0000-4000-8000-000000000001' and i.starts_at > now()),
  'Maya owns an upcoming appointment to ask coverage for'
);

select results_eq(
  $$ select f.title, f.kind, i.title, f.proposed_assignee_id
     from public.items f join public.items i on i.id = f.follow_up_of
     where f.circle_id = pg_temp.sample() $$,
  $$ values ('Pick up prescription by Friday'::text, 'task'::text, 'Cardiology — Dr. Patel'::text,
             '5a3b1e00-0000-4000-8000-000000000001'::uuid) $$,
  'the cardiology appointment has a follow-up task asked of Maya'
);

select ok(
  extract(isodow from (select i.starts_at from public.items i
                       where i.title = 'Pick up prescription by Friday') at time zone 'America/Vancouver') = 5
  and (select i.starts_at from public.items i where i.title = 'Pick up prescription by Friday') > now(),
  'the prescription is due on an upcoming Friday'
);

select ok(
  exists (select 1 from public.updates u join public.items i on i.id = u.item_id
          where u.circle_id = pg_temp.sample() and i.title = 'Cardiology — Dr. Patel'),
  'an update is linked to the cardiology appointment'
);

select ok(
  (select min(e.at) from public.activity_events e where e.circle_id = pg_temp.sample())
    < now() - interval '13 days',
  'history goes back two weeks'
);

select is_empty(
  $$ select 'event' from public.activity_events e where e.circle_id = pg_temp.sample() and e.at > now()
     union all
     select 'item' from public.items i where i.circle_id = pg_temp.sample()
       and (i.created_at > now() or i.updated_at > now() or i.updated_at < i.created_at)
     union all
     select 'update' from public.updates u where u.circle_id = pg_temp.sample() and u.created_at > now() $$,
  'nothing happened in the future'
);

-- PRD §17: who holds each item, and its requests, match its state.
select is_empty(
  $$ select i.title, i.state from public.items i
     where i.circle_id = pg_temp.sample()
       and not case i.state
         when 'needs_someone' then i.owner_id is null and i.proposed_assignee_id is null
         when 'awaiting_acceptance' then i.owner_id is null and i.proposed_assignee_id is not null
           and (select count(*) from public.assignment_requests r
                where r.item_id = i.id and r.status = 'pending' and r.assignee_id = i.proposed_assignee_id) = 1
         when 'cancelled' then i.owner_id is null and i.proposed_assignee_id is null
         else i.owner_id is not null and i.proposed_assignee_id is null
       end
       or (i.state <> 'awaiting_acceptance' and exists (
             select 1 from public.assignment_requests r where r.item_id = i.id and r.status = 'pending'))
       or (i.state = 'needs_coverage') <> exists (
             select 1 from public.coverage_requests r
             where r.item_id = i.id and r.status = 'open' and r.requester_id = i.owner_id) $$,
  'every item follows the PRD §17 rules for its state'
);

select is_empty(
  $$ select i.title from public.items i
     where i.circle_id = pg_temp.sample()
       and not exists (select 1 from public.activity_events e
                       where e.item_id = i.id and e.type = 'created' and e.actor_id = i.created_by) $$,
  'every item has a created event by whoever added it ("Added by")'
);

select is_empty(
  $$ select i.title from public.items i
     where i.circle_id = pg_temp.sample() and i.state = 'completed'
       and not exists (select 1 from public.activity_events e
                       where e.item_id = i.id and e.type = 'completed' and e.actor_id = i.owner_id) $$,
  'every completed item has a completed event by its owner ("Completed by")'
);

select is_empty(
  $$ select e.type from public.activity_events e
     where e.circle_id = pg_temp.sample()
       and e.type not in ('circle_created', 'member_joined', 'created', 'assigned', 'claimed', 'accepted',
                          'declined', 'withdrawn', 'completed', 'cancelled', 'coverage_requested',
                          'coverage_cancelled', 'coverage_taken') $$,
  'history uses the plan §4.2 event types'
);

-- ---------------------------------------------------------------------------
-- Rebuild with a demo guest in the circle who has changed things
-- ---------------------------------------------------------------------------
create temporary table first_build on commit drop as select pg_temp.fingerprint() as fp;

insert into auth.users (id) values ('b0000000-0000-0000-0000-00000000000b');
insert into public.circle_members (circle_id, user_id) values (pg_temp.sample(), 'b0000000-0000-0000-0000-00000000000b');
insert into public.items (circle_id, kind, title, starts_at, created_by)
values (pg_temp.sample(), 'task', 'Guest''s task', now(), 'b0000000-0000-0000-0000-00000000000b');
update public.items i set state = 'assigned', owner_id = 'b0000000-0000-0000-0000-00000000000b'
where i.circle_id = pg_temp.sample() and i.state = 'needs_someone';
delete from public.circle_members m
where m.circle_id = pg_temp.sample() and m.user_id = '5a3b1e00-0000-4000-8000-000000000002';
update public.profiles p set display_name = 'Dan' where p.id = '5a3b1e00-0000-4000-8000-000000000002';

select is(public.build_sample_circle(), pg_temp.sample(), 'a second build returns the same ID');

select is(
  (select count(*)::integer from public.circles c where c.care_recipient_name = 'Mom'),
  1,
  'there is still one sample circle'
);

select is(
  replace(pg_temp.fingerprint(), 'members 4', 'members 3'),
  (select fp from first_build),
  'the rebuilt circle has the same members, items, requests, updates and history'
);

select ok(
  exists (select 1 from public.circle_members m
          where m.circle_id = pg_temp.sample() and m.user_id = 'b0000000-0000-0000-0000-00000000000b')
  and (select p.display_name from public.profiles p where p.id = '5a3b1e00-0000-4000-8000-000000000002')
      = 'Daniel Hart',
  'the guest is still a member, and Daniel is back with his name'
);

select is(
  (select count(*)::integer from public.items i where i.circle_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'another circle is left alone'
);

-- ---------------------------------------------------------------------------
-- Who can call it
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.build_sample_circle()', 'execute')
    and not has_function_privilege('authenticated', 'public.build_sample_circle()', 'execute')
    and not has_function_privilege('anon', 'public.build_sample_circle()', 'execute'),
  'only the service role can build the sample circle'
);

-- As Maya, the coverage flow shows 1 of 2 remaining.
select set_config('request.jwt.claims',
  json_build_object('sub', '5a3b1e00-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select is(public.coverage_remaining(), 1, 'Maya sees 1 of 2 coverage requests remaining');

select * from finish();
rollback;
