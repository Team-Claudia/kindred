-- Task 4.5d: members read and save their own notification switches.
begin;
select plan(13);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'); -- Bob

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select requests, reminders, changes, updates, weekly_summary, comments, everything_else
     from public.my_notification_prefs() $$,
  $$ values (true, true, true, true, true, true, false) $$,
  'with no saved row, a member gets the PRD defaults'
);

select results_eq(
  $$ select count(*)::int from public.notification_prefs $$,
  $$ values (0) $$,
  'reading the defaults does not create a row'
);

select lives_ok(
  $$ select public.set_notification_pref('changes', false) $$,
  'a member can turn a category off'
);

select results_eq(
  $$ select requests, reminders, changes, updates, weekly_summary, comments, everything_else
     from public.my_notification_prefs() $$,
  $$ values (true, true, false, true, true, true, false) $$,
  'only that category changed; the rest keep their defaults'
);

select results_eq(
  $$ select everything_else from public.set_notification_pref('everything_else', true) $$,
  $$ values (true) $$,
  'saving returns the new switches, and an off-by-default category can be turned on'
);

select lives_ok(
  $$ select public.set_notification_pref('changes', true) $$,
  'turning a category back on is fine'
);

select throws_ok(
  $$ select public.set_notification_pref('everything', true) $$,
  'P0001', 'invalid_input',
  'an unknown category is invalid_input'
);

select throws_ok(
  $$ select public.set_notification_pref('user_id', true) $$,
  'P0001', 'invalid_input',
  'a column that is not a category is invalid_input'
);

select throws_ok(
  $$ select public.set_notification_pref('requests', null) $$,
  'P0001', 'invalid_input',
  'a missing on/off value is invalid_input'
);

select pg_temp.sign_in_as('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  $$ select requests, reminders, changes, updates, weekly_summary, comments, everything_else
     from public.my_notification_prefs() $$,
  $$ values (true, true, true, true, true, true, false) $$,
  'another member does not see Alice''s switches'
);

select throws_ok(
  $$ insert into public.notification_prefs (user_id) values (auth.uid()) $$,
  '42501', null,
  'the app cannot write the table directly'
);

select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('role', 'anon', true);

select throws_ok(
  $$ select public.my_notification_prefs() $$,
  '42501', null,
  'signed-out visitors cannot read switches'
);

reset role;

select results_eq(
  $$ select user_id, requests, changes, everything_else from public.notification_prefs $$,
  $$ values ('a0000000-0000-0000-0000-00000000000a'::uuid, true, true, true) $$,
  'only Alice has a row, with her saved switches'
);

select * from finish();
rollback;
