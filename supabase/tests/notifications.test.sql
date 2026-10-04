-- Task 4.5f: the in-app notification list (PRD US 11.6, plan §4.2, §4.3).
--
-- People: Alice and Bob are in circle X. Alice has three notifications, Bob
-- one.
begin;
select plan(12);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'); -- Bob

insert into public.circles (id, care_recipient_name) values
  ('10000000-0000-0000-0000-000000000001', 'Dad');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');

insert into public.notifications (id, user_id, kind, line) overriding system value values
  (1001, 'a0000000-0000-0000-0000-00000000000a', 'assignment_requested', 'Bob asked you to take something'),
  (1002, 'a0000000-0000-0000-0000-00000000000a', 'reminder', 'Coming up soon'),
  (1003, 'a0000000-0000-0000-0000-00000000000a', 'update_posted', 'Bob posted an update'),
  (2001, 'b0000000-0000-0000-0000-00000000000b', 'coverage_requested', 'Alice needs cover');

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

-- The IDs of the notifications that are still unread, whoever's they are.
create function pg_temp.unread() returns setof bigint language sql security definer as $$
  select id from public.notifications where read_at is null order by id
$$;

-- ---------------------------------------------------------------------------
-- Published and readable by their owner only
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ),
  'notifications are in the supabase_realtime publication, for the bell'
);

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select id from public.notifications order by id $$,
  array[1001::bigint, 1002, 1003],
  'a member reads only their own notifications'
);

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  $$ select id from public.notifications order by id $$,
  array[2001::bigint],
  'and so does everyone else'
);

-- ---------------------------------------------------------------------------
-- Marking one read
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.mark_notifications_read(1002) $$, 'a member marks one read');
reset role;
select results_eq($$ select pg_temp.unread() $$, array[1001::bigint, 1003, 2001],
  'only that one is read');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.mark_notifications_read(2001) $$,
  'marking someone else''s notification raises nothing');
reset role;
select results_eq($$ select pg_temp.unread() $$, array[1001::bigint, 1003, 2001],
  'but leaves it unread');

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.mark_notifications_read(999999) $$, 'an unknown ID does nothing');

-- Marking again keeps the time it was first read.
reset role;
update public.notifications set read_at = '2026-10-01 12:00+00' where id = 1002;
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.mark_notifications_read(1002);
reset role;
select is((select read_at from public.notifications where id = 1002), '2026-10-01 12:00+00'::timestamptz,
  'marking one already read keeps when it was read');

-- ---------------------------------------------------------------------------
-- Marking all read
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select public.mark_notifications_read();
reset role;
select results_eq($$ select pg_temp.unread() $$, array[2001::bigint],
  'mark all read clears all of the caller''s notifications and nobody else''s');

-- Signed out, there is nothing to mark.
select set_config('request.jwt.claims', '', true);
select set_config('role', 'authenticated', true);
select public.mark_notifications_read();
reset role;
select results_eq($$ select pg_temp.unread() $$, array[2001::bigint],
  'with nobody signed in, nothing changes');

select ok(
  has_function_privilege('authenticated', 'public.mark_notifications_read(bigint)', 'execute')
    and not has_function_privilege('anon', 'public.mark_notifications_read(bigint)', 'execute'),
  'signed-in members can call mark_notifications_read; signed-out visitors can''t'
);

select * from finish();
rollback;
