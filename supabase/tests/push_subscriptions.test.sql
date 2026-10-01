-- Task 1.4: members save and remove their own push subscriptions through RPCs.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

-- Act as a signed-in user. auth.uid() reads the JWT claims.
create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ select public.save_push_subscription(
       'https://push.example.test/sub-1',
       '{"p256dh": "key-1", "auth": "auth-1", "extra": "dropped"}'::jsonb
     ) $$,
  'a signed-in user can save a subscription'
);

select lives_ok(
  $$ select public.save_push_subscription(
       'https://push.example.test/sub-1',
       '{"p256dh": "key-2", "auth": "auth-2"}'::jsonb
     ) $$,
  'saving the same endpoint again is fine'
);

select throws_ok(
  $$ select public.save_push_subscription('http://push.example.test/sub', '{"p256dh": "k", "auth": "a"}') $$,
  'P0001', 'invalid_input',
  'the endpoint must be https'
);

select throws_ok(
  $$ select public.save_push_subscription('https://push.example.test/sub', '{"p256dh": "k"}') $$,
  'P0001', 'invalid_input',
  'both keys are required'
);

select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, keys)
     values (auth.uid(), 'https://push.example.test/direct', '{}') $$,
  '42501', null,
  'the app cannot write the table directly'
);

reset role;

select results_eq(
  $$ select user_id, keys from public.push_subscriptions where endpoint = 'https://push.example.test/sub-1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, '{"p256dh": "key-2", "auth": "auth-2"}'::jsonb) $$,
  'one row per endpoint, with the latest keys and only p256dh and auth'
);

select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'saving creates the profile row the subscription needs'
);

-- The same phone, now signed in as someone else.
select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000b2');

select public.delete_push_subscription('https://push.example.test/sub-1');
reset role;

select is(
  (select count(*)::int from public.push_subscriptions),
  1,
  'deleting someone else''s subscription does nothing'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000b2');
select public.save_push_subscription('https://push.example.test/sub-1', '{"p256dh": "key-3", "auth": "auth-3"}');
reset role;

select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://push.example.test/sub-1'),
  '00000000-0000-0000-0000-0000000000b2'::uuid,
  'saving an endpoint moves it to the account now using it'
);

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000b2');
select public.delete_push_subscription('https://push.example.test/sub-1');
reset role;

select is_empty(
  $$ select 1 from public.push_subscriptions $$,
  'members can delete their own subscription'
);

select ok(
  not has_function_privilege('anon', 'public.save_push_subscription(text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.delete_push_subscription(text)', 'execute')
    and has_function_privilege('authenticated', 'public.save_push_subscription(text, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.delete_push_subscription(text)', 'execute'),
  'only signed-in users can call the push subscription RPCs'
);

select * from finish();
rollback;
