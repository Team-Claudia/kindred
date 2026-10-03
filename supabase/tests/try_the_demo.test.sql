-- Task 4.2: Try the demo. join_demo_circle() for anonymous guests,
-- reset_demo_circle() for the service role, and the nightly clean-up.
--
-- People: Gail and Gus are anonymous demo guests, Gina is an anonymous guest
-- who already has a name, Alice is a real account in her own circle X ("Dad"),
-- and Olive is an anonymous guest from two days ago.
begin;
select plan(32);

create function pg_temp.sample() returns uuid language sql as $$
  select '5a3b1e00-0000-4000-8000-000000000100'::uuid
$$;

create function pg_temp.claims(user_id text, anonymous boolean) returns text language sql as $$
  select json_build_object('sub', user_id, 'role', 'authenticated', 'is_anonymous', anonymous)::text
$$;

insert into auth.users (id, is_anonymous) values
  ('a0000000-0000-0000-0000-00000000000a', false), -- Alice
  ('b0000000-0000-0000-0000-00000000000b', true),  -- Gail
  ('c0000000-0000-0000-0000-00000000000c', true),  -- Gus
  ('d0000000-0000-0000-0000-00000000000d', true);  -- Gina
update public.profiles p set display_name = 'Gina' where p.id = 'd0000000-0000-0000-0000-00000000000d';
insert into auth.users (id, is_anonymous, created_at) values
  ('e0000000-0000-0000-0000-00000000000e', true, now() - interval '2 days'), -- Olive
  ('f0000000-0000-0000-0000-00000000000f', false, now() - interval '2 days'); -- an old real account

insert into public.circles (id, care_recipient_name) values ('10000000-0000-0000-0000-000000000001', 'Dad');
insert into public.circle_members (circle_id, user_id, role)
values ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin');
insert into public.items (circle_id, kind, title, starts_at)
values ('10000000-0000-0000-0000-000000000001', 'task', 'Laundry', now());

-- ---------------------------------------------------------------------------
-- The migration loaded the sample circle
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::integer from public.items i where i.circle_id = pg_temp.sample()),
  16,
  'the migration loaded the sample circle with its 16 items'
);

select ok(
  exists (select 1 from cron.job where jobname = 'demo-nightly-cleanup' and schedule = '0 10 * * *'
          and command = 'select public.demo_nightly_cleanup()'),
  'pg_cron runs the demo clean-up every night'
);

-- ---------------------------------------------------------------------------
-- join_demo_circle: refuses real accounts
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-0000-0000-00000000000a', false), true);

select throws_ok(
  $$ select public.join_demo_circle() $$,
  'P0001', 'invalid_input',
  'a real account cannot join the demo circle'
);

set local "request.jwt.claims" to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.join_demo_circle() $$,
  'P0001', 'invalid_input',
  'nor can a token without is_anonymous'
);

-- ---------------------------------------------------------------------------
-- As Gail, an anonymous guest
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', pg_temp.claims('b0000000-0000-0000-0000-00000000000b', true), true);

select is_empty(
  $$ select 1 from public.items $$,
  'before joining, a guest sees no items'
);

select is(public.join_demo_circle(), pg_temp.sample(), 'join_demo_circle returns the sample circle''s ID');

select results_eq(
  $$ select cm.circle_id, cm.role from public.circle_members cm
     where cm.user_id = 'b0000000-0000-0000-0000-00000000000b' $$,
  $$ values (pg_temp.sample(), 'member'::text) $$,
  'the guest is a member of the sample circle'
);

select matches(
  (select p.display_name from public.profiles p where p.id = 'b0000000-0000-0000-0000-00000000000b'),
  '^Guest [0-9]{4}$',
  'a guest with no name is called Guest and four digits'
);

select results_eq(
  $$ select i.title, i.state, p.display_name from public.items i
     join public.profiles p on p.id = i.created_by
     where i.proposed_assignee_id = 'b0000000-0000-0000-0000-00000000000b'
     order by i.starts_at $$,
  $$ values ('Pick up Mom''s library books'::text, 'awaiting_acceptance'::text, 'Maya Hart'::text),
            ('Drive Mom to the dentist', 'awaiting_acceptance', 'Daniel Hart'),
            ('Call Mom after dinner', 'awaiting_acceptance', 'Priya Hart') $$,
  'three requests await the guest, one from each sibling'
);

select ok(
  (select bool_and(i.starts_at > now() and i.starts_at < now() + interval '5 days')
   from public.items i where i.proposed_assignee_id = 'b0000000-0000-0000-0000-00000000000b'),
  'the requests are due in the next few days'
);

select is(
  (select count(*)::integer from public.assignment_requests r
   where r.assignee_id = 'b0000000-0000-0000-0000-00000000000b' and r.status = 'pending'
     and r.assigner_id = (select i.created_by from public.items i where i.id = r.item_id)),
  3,
  'each has a pending assignment request from the person who asked'
);

select is(
  (select count(*)::integer from public.activity_events e
   join public.items i on i.id = e.item_id
   where i.proposed_assignee_id = 'b0000000-0000-0000-0000-00000000000b'
     and e.type = 'created' and e.actor_id = i.created_by
     and e.data ->> 'assignee_id' = 'b0000000-0000-0000-0000-00000000000b'),
  3,
  'each has a created event, as create_item writes'
);

select ok(
  (select count(*)::integer from public.items i where i.circle_id = pg_temp.sample()) = 19,
  'the guest sees the sample circle''s items and their own'
);

select is_empty(
  $$ select 1 from public.items i where i.circle_id = '10000000-0000-0000-0000-000000000001'
     union all
     select 1 from public.circles c where c.id = '10000000-0000-0000-0000-000000000001' $$,
  'a guest cannot read another circle'
);

-- Idempotent: a second tap changes nothing.
select is(public.join_demo_circle(), pg_temp.sample(), 'joining again returns the same circle');

reset role;

select is(
  (select count(*)::integer from public.items i
   where i.proposed_assignee_id = 'b0000000-0000-0000-0000-00000000000b'),
  3,
  'joining again creates no more requests'
);

select is(
  (select count(*)::integer from public.activity_events e
   where e.actor_id = 'b0000000-0000-0000-0000-00000000000b' and e.type = 'member_joined'),
  1,
  'and logs one member_joined'
);

select is(
  (select count(*)::integer from public.outbox o
   where o.payload ->> 'recipient_id' = 'b0000000-0000-0000-0000-00000000000b'
     and o.payload ->> 'event' = 'assignment_requested'),
  3,
  'the guest is notified of each request'
);

-- ---------------------------------------------------------------------------
-- Other guests
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims('d0000000-0000-0000-0000-00000000000d', true), true);
select public.join_demo_circle();
select set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-0000-0000-00000000000c', true), true);
select public.join_demo_circle();
reset role;

select is(
  (select p.display_name from public.profiles p where p.id = 'd0000000-0000-0000-0000-00000000000d'),
  'Gina',
  'a guest who has a name keeps it'
);

select is(
  (select count(*)::integer from public.items i where i.circle_id = pg_temp.sample()),
  25,
  'each guest gets their own three requests'
);

-- An anonymous user already in another circle stays there (BR-12).
insert into public.circle_members (circle_id, user_id)
values ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e');
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-0000-0000-00000000000e', true), true);
select throws_ok(
  $$ select public.join_demo_circle() $$,
  'P0001', 'already_in_other_circle',
  'an anonymous user in another circle cannot join the demo'
);
reset role;
delete from public.circle_members m where m.user_id = 'e0000000-0000-0000-0000-00000000000e';

-- A guest changes the shared circle.
update public.items i set state = 'assigned', owner_id = 'c0000000-0000-0000-0000-00000000000c'
where i.circle_id = pg_temp.sample() and i.state = 'needs_someone';

-- ---------------------------------------------------------------------------
-- reset_demo_circle
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims('b0000000-0000-0000-0000-00000000000b', true), true);
select throws_ok(
  $$ select public.reset_demo_circle() $$,
  '42501', null,
  'a guest cannot reset the demo circle'
);
reset role;

select ok(
  has_function_privilege('service_role', 'public.reset_demo_circle()', 'execute')
    and not has_function_privilege('authenticated', 'public.reset_demo_circle()', 'execute')
    and not has_function_privilege('anon', 'public.reset_demo_circle()', 'execute')
    and has_function_privilege('service_role', 'public.demo_nightly_cleanup()', 'execute')
    and not has_function_privilege('authenticated', 'public.demo_nightly_cleanup()', 'execute')
    and not has_function_privilege('authenticated', 'public.lock_demo_circle()', 'execute'),
  'only the service role can reset the demo circle or run the clean-up'
);

select set_config('test.reset_started', clock_timestamp()::text, true);
set local role service_role;
select lives_ok($$ select public.reset_demo_circle() $$, 'the service role can reset the demo circle');
reset role;

select ok(
  clock_timestamp() - current_setting('test.reset_started')::timestamptz < interval '1 minute',
  'the reset takes under a minute'
);

select is(
  (select count(*)::integer from public.circles c where c.id = pg_temp.sample()),
  1,
  'there is exactly one sample circle'
);

select set_eq(
  $$ select m.user_id from public.circle_members m where m.circle_id = pg_temp.sample() $$,
  array['5a3b1e00-0000-4000-8000-000000000001', '5a3b1e00-0000-4000-8000-000000000002',
        '5a3b1e00-0000-4000-8000-000000000003']::uuid[],
  'only the three sample people are left; the guests are removed'
);

select is(
  (select string_agg(s.state || '=' || s.n, ',' order by s.state)
   from (select i.state, count(*) n from public.items i
         where i.circle_id = pg_temp.sample() group by i.state) s),
  'assigned=3,awaiting_acceptance=1,cancelled=1,completed=4,needs_coverage=1,needs_someone=6',
  'the sample items are back as they were, without the guests'' requests or changes'
);

select is(
  (select count(*)::integer from public.items i where i.circle_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'another circle is left alone'
);

-- After a reset, a guest from earlier can join again and gets new requests.
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims('b0000000-0000-0000-0000-00000000000b', true), true);
select public.join_demo_circle();
reset role;

select is(
  (select count(*)::integer from public.items i
   where i.proposed_assignee_id = 'b0000000-0000-0000-0000-00000000000b'),
  3,
  'a guest removed by the reset can join again'
);

-- ---------------------------------------------------------------------------
-- Nightly clean-up
-- ---------------------------------------------------------------------------
set local role service_role;
select public.demo_nightly_cleanup();
reset role;

select set_eq(
  $$ select u.id from auth.users u
     where u.id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b',
                    'e0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-00000000000f',
                    '5a3b1e00-0000-4000-8000-000000000001', '5a3b1e00-0000-4000-8000-000000000002',
                    '5a3b1e00-0000-4000-8000-000000000003') $$,
  array['a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b',
        'f0000000-0000-0000-0000-00000000000f',
        '5a3b1e00-0000-4000-8000-000000000001', '5a3b1e00-0000-4000-8000-000000000002',
        '5a3b1e00-0000-4000-8000-000000000003']::uuid[],
  'the clean-up deletes only anonymous users over a day old, never the sample people or real accounts'
);

select ok(
  not exists (select 1 from public.profiles p where p.id = 'e0000000-0000-0000-0000-00000000000e')
  and not exists (select 1 from public.circle_members m where m.circle_id = pg_temp.sample()
                  and m.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'the old guest''s profile goes with them, and the clean-up also resets the circle'
);

select * from finish();
rollback;
