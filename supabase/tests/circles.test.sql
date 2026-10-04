-- Task 1.2: Care Circles, invites, joining and Row-Level Security.
--
-- People: Alice creates circle X ("Dad"); Bob, Erin and Frank join it.
-- Carol creates circle Y ("Mum"). Dave isn't in any circle.
-- Each "as <name>" switches the signed-in user; "as postgres" bypasses RLS
-- to set up or check data.
begin;
select plan(78);

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-00000000000a'), -- Alice
  ('b0000000-0000-0000-0000-00000000000b'), -- Bob
  ('c0000000-0000-0000-0000-00000000000c'), -- Carol
  ('d0000000-0000-0000-0000-00000000000d'), -- Dave
  ('e0000000-0000-0000-0000-00000000000e'), -- Erin
  ('f0000000-0000-0000-0000-00000000000f'); -- Frank

-- ---------------------------------------------------------------------------
-- create_circle and create_invite (as Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select public.create_circle('   ', 'parent', 'America/Toronto') $$,
  'P0001', 'invalid_input',
  'a circle needs the care recipient''s name'
);

select throws_ok(
  $$ select public.create_circle('Dad', 'parent', 'Not/AZone') $$,
  'P0001', 'invalid_input',
  'a circle needs a real time zone'
);

select isnt(
  set_config('test.x', public.create_circle('Dad', 'parent', 'America/Toronto', 'Alice Smith')::text, true),
  null,
  'create_circle returns the new circle''s ID'
);

select is(
  public.current_circle_id()::text, current_setting('test.x'),
  'current_circle_id() returns the caller''s circle'
);

select is(
  (select cm.role || '/' || cm.relationship from public.circle_members cm
   where cm.user_id = 'a0000000-0000-0000-0000-00000000000a'),
  'admin/parent',
  'the creator is an admin, with their relationship recorded'
);

select is(
  (select c.care_recipient_name || ' ' || c.time_zone from public.circles c),
  'Dad America/Toronto',
  'the circle has the care recipient''s name and time zone'
);

select is(
  (select p.display_name from public.profiles p where p.id = 'a0000000-0000-0000-0000-00000000000a'),
  'Alice Smith',
  'the creator''s name is saved to their profile'
);

select throws_ok(
  $$ select public.create_circle('Mum', 'parent', 'America/Toronto') $$,
  'P0001', 'already_in_circle',
  'BR-12: a member can''t create a second circle'
);

select matches(
  set_config('test.code_x', public.create_invite(), true),
  '^[A-Za-z0-9]{8}$',
  'create_invite returns a random 8-character code'
);

select ok(
  (select i.expires_at between now() + interval '14 days' - interval '1 minute'
                           and now() + interval '14 days' + interval '1 minute'
   from public.invites i where i.code = current_setting('test.code_x')),
  'an invite works for 14 days'
);

select isnt(
  public.create_invite(), current_setting('test.code_x'),
  'each invite gets a new code'
);

-- ---------------------------------------------------------------------------
-- Not in a circle (as Dave)
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}';

select throws_ok($$ select public.create_invite() $$, 'P0001', 'not_member',
  'someone outside a circle can''t create an invite');
select throws_ok($$ select public.leave_circle() $$, 'P0001', 'not_member',
  'someone outside a circle can''t leave one');
select is(public.current_circle_id(), null, 'current_circle_id() is null outside a circle');
select is_empty($$ select 1 from public.circles $$, 'someone outside a circle sees no circles');

-- ---------------------------------------------------------------------------
-- join_circle (as Bob)
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  public.join_circle(current_setting('test.code_x'), 'grandparent', 'Bob Jones')::text,
  current_setting('test.x'),
  'join_circle returns the invite''s circle'
);

select is(
  (select cm.role || '/' || cm.relationship from public.circle_members cm
   where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'member/grandparent',
  'joining makes you a member, with your relationship recorded'
);

select is(
  public.join_circle(current_setting('test.code_x'))::text,
  current_setting('test.x'),
  'joining again returns the same circle'
);

select is(
  (select count(*) from public.circle_members cm
   where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'joining twice doesn''t duplicate membership'
);

select is(
  (select cm.relationship from public.circle_members cm
   where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'grandparent',
  'joining again leaves the relationship as it was'
);

select throws_ok(
  $$ select public.create_circle('Mum', 'parent', 'America/Toronto') $$,
  'P0001', 'already_in_circle',
  'BR-12: someone who joined a circle can''t create another'
);

-- ---------------------------------------------------------------------------
-- A second circle, and BR-12 on joining (as Carol)
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select isnt(
  set_config('test.y', public.create_circle('Mum', 'child', 'America/Vancouver', 'Carol White')::text, true),
  null,
  'another family creates its own circle'
);

select throws_ok(
  format('select public.join_circle(%L)', current_setting('test.code_x')),
  'P0001', 'already_in_other_circle',
  'BR-12: a member of one circle can''t join another'
);

select throws_ok(
  $$ select public.join_circle('NoSuch23') $$,
  'P0001', 'invite_not_found',
  'an unknown code fails with invite_not_found'
);

select is(
  (select p.in_other_circle from public.invite_preview(current_setting('test.code_x')) p),
  true,
  'invite_preview tells a member of another circle they''re already in one'
);

-- ---------------------------------------------------------------------------
-- Expired invites
-- ---------------------------------------------------------------------------
reset role;
insert into public.invites (code, circle_id, created_by, expires_at)
values ('Expired1', current_setting('test.x')::uuid, 'a0000000-0000-0000-0000-00000000000a',
        now() - interval '1 day');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}';

select throws_ok(
  $$ select public.join_circle('Expired1') $$,
  'P0001', 'invite_expired',
  'an expired invite fails with invite_expired'
);

set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  public.join_circle('Expired1')::text, current_setting('test.x'),
  'an expired link still opens the circle for someone already in it'
);

-- ---------------------------------------------------------------------------
-- invite_preview for a signed-out visitor (as anon)
-- ---------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select results_eq(
  format(
    'select care_recipient_name, inviter_name, member_names, member_count, is_member, in_other_circle
     from public.invite_preview(%L)',
    current_setting('test.code_x')
  ),
  $$ values ('Dad'::text, 'Alice'::text, array['Alice', 'Bob']::text[], 2, false, false) $$,
  'invite_preview shows a signed-out visitor the circle, the inviter and first names only'
);

select throws_ok($$ select * from public.invite_preview('Expired1') $$, 'P0001', 'invite_expired',
  'invite_preview reports an expired invite');
select throws_ok($$ select * from public.invite_preview('NoSuch23') $$, 'P0001', 'invite_not_found',
  'invite_preview reports an unknown code');
select is_empty($$ select 1 from public.circles $$, 'signed-out visitors can''t read circles');
select is_empty($$ select 1 from public.profiles $$, 'signed-out visitors can''t read profiles');

-- ---------------------------------------------------------------------------
-- A member of circle Y can't read anything in circle X (BR-07)
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  v_x uuid := current_setting('test.x')::uuid;
  v_series uuid;
  v_item uuid;
begin
  insert into public.series (circle_id, repeat, until, kind, title, starts_at)
  values (v_x, 'weekly', now() + interval '1 month', 'task', 'Pick up prescriptions', now())
  returning id into v_series;
  insert into public.items (circle_id, kind, title, starts_at, series_id, private_notes)
  values (v_x, 'task', 'Pick up prescriptions', now(), v_series, 'Pharmacy on Main')
  returning id into v_item;
  insert into public.assignment_requests (circle_id, item_id) values (v_x, v_item);
  insert into public.coverage_requests (circle_id, item_id) values (v_x, v_item);
  insert into public.updates (circle_id, body) values (v_x, 'Dad slept well');
  insert into public.comments (circle_id, item_id, body) values (v_x, v_item, 'Thanks');
end $$;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is_empty(
  format('select 1 from public.circles where id = %L', current_setting('test.x')),
  'a member of circle Y can''t read circle X'
);

select is_empty(
  format('select 1 from public.%I where circle_id = %L', t.name, current_setting('test.x')),
  format('a member of circle Y can''t read circle X''s %s', t.name)
)
from unnest(array[
  'activity_events', 'assignment_requests', 'circle_members', 'comments', 'coverage_requests',
  'invites', 'items', 'series', 'updates'
]) as t(name);

select is_empty(
  $$ select 1 from public.profiles
     where id in ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b') $$,
  'a member of circle Y can''t read the profiles of circle X''s members'
);

select is(
  (select array_agg(c.care_recipient_name) from public.circles c),
  array['Mum'],
  'a member of circle Y sees only circle Y'
);

-- The same reads as a member of circle X do find the rows, so the checks
-- above aren't passing just because the tables are empty.
set local "request.jwt.claims" to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select isnt_empty(
  format('select 1 from public.%I where circle_id = %L', t.name, current_setting('test.x')),
  format('a member of circle X can read its %s', t.name)
)
from unnest(array[
  'activity_events', 'assignment_requests', 'circle_members', 'comments', 'coverage_requests',
  'invites', 'items', 'series', 'updates'
]) as t(name);

select is(
  (select p.display_name from public.profiles p where p.id = 'b0000000-0000-0000-0000-00000000000b'),
  'Bob Jones',
  'members can read each other''s names'
);

-- ---------------------------------------------------------------------------
-- No direct writes
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.items (circle_id, kind, title, starts_at) values (%L, 'task', 'Sneaky', now()) $$,
    current_setting('test.x')
  ),
  '42501', null,
  'members can''t insert rows directly'
);

set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
update public.circle_members set role = 'admin' where user_id = 'b0000000-0000-0000-0000-00000000000b';

select is(
  (select cm.role from public.circle_members cm where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'member',
  'members can''t make themselves admin by writing the table'
);

-- ---------------------------------------------------------------------------
-- Admins: set_admin, remove_member, leave_circle and last-admin promotion
-- ---------------------------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select lives_ok(format('select public.join_circle(%L, %L)', current_setting('test.code_x'), 'parent'),
  'Erin joins circle X');
set local "request.jwt.claims" to '{"sub":"f0000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select lives_ok(format('select public.join_circle(%L)', current_setting('test.code_x')),
  'Frank joins circle X without giving a relationship');

-- Joined: Alice first, then Erin, then Bob, then Frank.
reset role;
update public.circle_members cm set joined_at = now() - interval '3 days'
  where cm.user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.circle_members cm set joined_at = now() - interval '2 days'
  where cm.user_id = 'e0000000-0000-0000-0000-00000000000e';
update public.circle_members cm set joined_at = now() - interval '1 day'
  where cm.user_id = 'b0000000-0000-0000-0000-00000000000b';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select throws_ok($$ select public.set_admin('f0000000-0000-0000-0000-00000000000f') $$,
  'P0001', 'not_admin', 'only admins can set_admin');
select throws_ok($$ select public.remove_member('f0000000-0000-0000-0000-00000000000f') $$,
  'P0001', 'not_admin', 'only admins can remove members');

set local "request.jwt.claims" to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok($$ select public.set_admin('c0000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'not_member', 'set_admin only works on members of your own circle');
select throws_ok($$ select public.remove_member('c0000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'not_member', 'remove_member only works on members of your own circle');
select throws_ok($$ select public.remove_member('a0000000-0000-0000-0000-00000000000a') $$,
  'P0001', 'invalid_input', 'admins leave rather than remove themselves');

select lives_ok($$ select public.remove_member('f0000000-0000-0000-0000-00000000000f') $$,
  'an admin can remove a member');
select is_empty(
  $$ select 1 from public.circle_members where user_id = 'f0000000-0000-0000-0000-00000000000f' $$,
  'the removed member is no longer in the circle'
);

select lives_ok($$ select public.leave_circle() $$, 'the only admin can leave');

reset role;
select is(
  (select cm.role from public.circle_members cm where cm.user_id = 'e0000000-0000-0000-0000-00000000000e'),
  'admin',
  'when the last admin leaves, the longest-standing remaining member becomes admin'
);
select is(
  (select cm.role from public.circle_members cm where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'member',
  'only one member is promoted'
);
select is_empty(
  $$ select 1 from public.circle_members where user_id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'the member who left is no longer in the circle'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"e0000000-0000-0000-0000-00000000000e","role":"authenticated"}';

select lives_ok($$ select public.set_admin('b0000000-0000-0000-0000-00000000000b') $$,
  'an admin can make another member an admin');
select is(
  (select cm.role from public.circle_members cm where cm.user_id = 'b0000000-0000-0000-0000-00000000000b'),
  'admin',
  'a circle can have several admins'
);
select lives_ok($$ select public.set_admin('b0000000-0000-0000-0000-00000000000b') $$,
  'set_admin on an existing admin does nothing');

-- A member who leaves can start or join another circle.
set local "request.jwt.claims" to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.current_circle_id(), null, 'after leaving, a member has no circle');

-- The last member out deletes the circle.
set local "request.jwt.claims" to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select lives_ok($$ select public.leave_circle() $$, 'the last member can leave');
reset role;
select is_empty(
  format('select 1 from public.circles where id = %L', current_setting('test.y')),
  'when the last member leaves, the circle is deleted'
);

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
select ok(
  has_function_privilege('anon', 'public.invite_preview(text)', 'execute')
    and has_function_privilege('authenticated', 'public.invite_preview(text)', 'execute'),
  'anyone with the link can preview an invite'
);
select ok(
  not has_function_privilege('anon', 'public.join_circle(text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.join_circle(text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.create_circle(text, text, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.set_admin(uuid)', 'execute'),
  'only signed-in users can create, join and manage circles'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_profile(uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.after_member_left(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.clean_relationship(text)', 'execute'),
  'internal helpers can''t be called from the app'
);

select * from finish();
rollback;
