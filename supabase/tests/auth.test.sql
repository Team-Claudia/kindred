-- Task 1.1: every account gets exactly one profile, and a member can see
-- their own circle membership (for the sign-in guard) but no one else's.
begin;
select plan(10);

-- A Google sign-in: the name comes from the Google profile.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-00000000000a', 'google@example.com',
  '{"full_name": "Maya Example", "name": "Maya Example"}'
);

select results_eq(
  $$ select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('Maya Example'::text) $$,
  'a Google sign-in creates a profile with the Google name'
);

-- An email-code sign-in: no name yet; the welcome screen asks for one.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000b', 'code@example.com', '{}');

select results_eq(
  $$ select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values (null::text) $$,
  'an email sign-in creates a profile with no name'
);

-- Only "name" present, padded with spaces.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000c', 'name@example.com', '{"name": "  Jonah  "}');

select results_eq(
  $$ select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c' $$,
  $$ values ('Jonah'::text) $$,
  'falls back to the name field and trims it'
);

-- Anonymous demo guests get a profile too.
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000000d', true);

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  1,
  'an anonymous sign-in creates a profile'
);

-- Signing in again updates the same auth.users row, so nothing new is created.
update auth.users
set last_sign_in_at = now(), raw_user_meta_data = '{"full_name": "Maya Renamed"}'
where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'signing in again keeps one profile'
);

select results_eq(
  $$ select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('Maya Example'::text) $$,
  'signing in again does not overwrite the name the member has'
);

-- Running the trigger function again for an existing account is harmless.
select lives_ok(
  $$ insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a')
     on conflict (id) do nothing $$,
  'a repeat profile insert is ignored'
);

select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
    and not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'the app cannot call the profile trigger function'
);

-- Membership visibility under RLS.
insert into public.circles (id, care_recipient_name)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Dad'),
  ('00000000-0000-0000-0000-0000000000c2', 'Mum');
insert into public.circle_members (circle_id, user_id)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

select results_eq(
  $$ select circle_id from public.circle_members $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid) $$,
  'a member sees their own membership and no one else''s'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

select is_empty(
  $$ select circle_id from public.circle_members $$,
  'someone in no circle sees no memberships'
);

reset role;

select * from finish();
rollback;
