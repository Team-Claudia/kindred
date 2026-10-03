-- Task 4.5a: Google Calendar connect and "Who's free?" (ADR-008, US 5.1, 6.1).
--
-- People: Alice and Bob are in circle X. Carol is in circle Y.
begin;
select plan(21);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('c0000000-0000-0000-0000-00000000000c'); -- Carol

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto'),
  ('20000000-0000-0000-0000-000000000002', 'Mum', 'America/Toronto');

insert into public.circle_members (circle_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c');

create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

create function pg_temp.secret_id(person uuid) returns uuid language sql security definer as $$
  select cs.google_secret_id from public.calendar_settings cs where cs.user_id = person
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.google_calendar_connected()', 'execute')
    and has_function_privilege('authenticated', 'public.disconnect_google_calendar()', 'execute'),
  'members can check and clear their own connection'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_google_connection(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.save_google_connection(uuid, text)', 'execute'),
  'only the service role saves a connection'
);
select ok(
  not has_function_privilege('authenticated', 'public.availability_tokens(uuid, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.availability_tokens(uuid, uuid)', 'execute'),
  'only the service role reads refresh tokens'
);
select ok(
  has_function_privilege('service_role', 'public.save_google_connection(uuid, text)', 'execute')
    and has_function_privilege('service_role', 'public.availability_tokens(uuid, uuid)', 'execute'),
  'the service role can save connections and read tokens'
);
select ok(
  not has_function_privilege('anon', 'public.google_calendar_connected()', 'execute')
    and not has_function_privilege('anon', 'public.disconnect_google_calendar()', 'execute'),
  'signed-out visitors can''t call the member RPCs'
);

-- ---------------------------------------------------------------------------
-- Not connected
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select is(public.google_calendar_connected(), false, 'a member who hasn''t connected is not connected');
reset role;

-- ---------------------------------------------------------------------------
-- save_google_connection
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.save_google_connection('a0000000-0000-0000-0000-00000000000a', '  ') $$,
  'invalid_input',
  'a blank token is refused'
);
select throws_ok(
  $$ select public.save_google_connection('d0000000-0000-0000-0000-00000000000d', 'token') $$,
  'not_member',
  'an unknown user is refused'
);

select lives_ok(
  $$ select public.save_google_connection('a0000000-0000-0000-0000-00000000000a', 'alice-token-1') $$,
  'saving Alice''s connection works, with no settings row yet'
);
select is(
  (select decrypted_secret from vault.decrypted_secrets
   where id = pg_temp.secret_id('a0000000-0000-0000-0000-00000000000a')),
  'alice-token-1',
  'the refresh token is in Vault, under calendar_settings.google_secret_id'
);
select is(
  (select secret from vault.secrets where id = pg_temp.secret_id('a0000000-0000-0000-0000-00000000000a')) = 'alice-token-1',
  false,
  'Vault stores it encrypted'
);

create temp table first_secret on commit drop as
  select pg_temp.secret_id('a0000000-0000-0000-0000-00000000000a') as id;

select public.save_google_connection('a0000000-0000-0000-0000-00000000000a', 'alice-token-2');
select is(
  (select decrypted_secret from vault.decrypted_secrets
   where id = pg_temp.secret_id('a0000000-0000-0000-0000-00000000000a')),
  'alice-token-2',
  'connecting again replaces the token'
);
select is_empty(
  $$ select 1 from vault.secrets where id = (select id from first_secret) $$,
  'and deletes the old secret'
);

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select is(public.google_calendar_connected(), true, 'Alice is connected');
reset role;

-- ---------------------------------------------------------------------------
-- availability_tokens
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select member_id, refresh_token from public.availability_tokens(
       '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $$,
  $$ values ('a0000000-0000-0000-0000-00000000000a'::uuid, 'alice-token-2'::text),
            ('b0000000-0000-0000-0000-00000000000b'::uuid, null::text) $$,
  'every member of the caller''s circle, with a token only for those connected'
);
select throws_ok(
  $$ select * from public.availability_tokens(
       '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c') $$,
  'not_member',
  'a caller from another circle learns nothing'
);

-- ---------------------------------------------------------------------------
-- disconnect_google_calendar
-- ---------------------------------------------------------------------------

create temp table second_secret on commit drop as
  select pg_temp.secret_id('a0000000-0000-0000-0000-00000000000a') as id;
grant select on second_secret to authenticated;

select pg_temp.sign_in_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.disconnect_google_calendar() $$, 'Alice disconnects');
select is(public.google_calendar_connected(), false, 'Alice is no longer connected');
select lives_ok($$ select public.disconnect_google_calendar() $$, 'disconnecting again does nothing');
reset role;

select is_empty(
  $$ select 1 from vault.secrets where id = (select id from second_secret) $$,
  'disconnecting deletes the refresh token from Vault'
);

-- Deleting the account (profile cascades to calendar_settings) deletes the secret too.
select public.save_google_connection('b0000000-0000-0000-0000-00000000000b', 'bob-token');
create temp table bob_secret on commit drop as
  select pg_temp.secret_id('b0000000-0000-0000-0000-00000000000b') as id;
delete from auth.users where id = 'b0000000-0000-0000-0000-00000000000b';
select is_empty(
  $$ select 1 from vault.secrets where id = (select id from bob_secret) $$,
  'deleting an account deletes its Google token'
);

select * from finish();
rollback;
