-- Task 4.3: members change their own name from Care Circle and settings.
begin;
select plan(7);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');

-- Act as a signed-in user. auth.uid() reads the JWT claims.
create function pg_temp.sign_in_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

select pg_temp.sign_in_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ select public.set_display_name('  Maya Reyes  ') $$,
  'a signed-in member can change their name'
);

select is(
  (select p.display_name from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000a1'),
  'Maya Reyes',
  'the name is saved, trimmed'
);

select throws_ok(
  $$ select public.set_display_name('   ') $$,
  'P0001', 'invalid_input',
  'a blank name is refused'
);

select throws_ok(
  $$ select public.set_display_name(repeat('x', 81)) $$,
  'P0001', 'invalid_input',
  'a name over 80 characters is refused'
);

-- With no update policy, a direct write changes nothing.
update public.profiles set display_name = 'Hacked' where id = auth.uid();

reset role;
select is(
  (select p.display_name from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000a1'),
  'Maya Reyes',
  'the app cannot write profiles directly'
);

select is(
  (select p.display_name from public.profiles p where p.id = '00000000-0000-0000-0000-0000000000b2'),
  null,
  'nobody else''s name changes'
);

set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
select throws_ok(
  $$ select public.set_display_name('Someone') $$,
  '42501', null,
  'signed-out visitors cannot call it'
);

select * from finish();
rollback;
