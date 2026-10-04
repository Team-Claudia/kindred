-- Task 4.5e: account export and deletion (US 1.3, ADR-015).
--
-- People: Alice (the only admin), Bob (joined before Cara) and Cara are in
-- circle X. Dan is the only member of circle Y. Erin is in circle Z. Gus is a
-- Try the demo guest.
begin;
select plan(48);

insert into auth.users (id, is_anonymous) values
  ('a0000000-0000-0000-0000-00000000000a', false), -- Alice
  ('b0000000-0000-0000-0000-00000000000b', false), -- Bob
  ('c0000000-0000-0000-0000-00000000000c', false), -- Cara
  ('d0000000-0000-0000-0000-00000000000d', false), -- Dan
  ('e0000000-0000-0000-0000-00000000000e', false), -- Erin
  ('90000000-0000-0000-0000-000000000009', true);  -- Gus, a guest

update public.profiles set display_name = 'Alice Reyes' where id = 'a0000000-0000-0000-0000-00000000000a';

insert into public.circles (id, care_recipient_name, time_zone) values
  ('10000000-0000-0000-0000-000000000001', 'Dad', 'America/Toronto'),
  ('20000000-0000-0000-0000-000000000002', 'Mum', 'America/Toronto'),
  ('30000000-0000-0000-0000-000000000003', 'Gran', 'America/Toronto');

insert into public.circle_members (circle_id, user_id, role, relationship, joined_at) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'admin', 'Parent', '2026-01-01'),
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'member', null, '2026-02-01'),
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'member', null, '2026-03-01'),
  ('20000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000d', 'admin', null, '2026-01-01'),
  ('30000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e', 'admin', null, '2026-01-01');

-- Circle X's items. Alice is on i1 to i3, asked Bob to take i4, and finished i5.
insert into public.items (id, circle_id, kind, title, starts_at, state, owner_id, proposed_assignee_id, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'task', 'Pick up pills',
   now() + interval '2 days', 'assigned', 'a0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000001', 'appointment', 'Dentist',
   now() + interval '3 days', 'needs_coverage', 'a0000000-0000-0000-0000-00000000000a', null, 'b0000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-000000000001', 'task', 'Groceries',
   now() + interval '4 days', 'awaiting_acceptance', null, 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-000000000001', 'task', 'Laundry',
   now() + interval '5 days', 'awaiting_acceptance', null, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-000000000001', 'task', 'Old errand',
   now() - interval '5 days', 'completed', 'a0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-000000000001', 'task', 'Bob''s job',
   now() + interval '6 days', 'assigned', 'b0000000-0000-0000-0000-00000000000b', null, 'b0000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-000000000003', 'task', 'Erin''s job',
   now() + interval '2 days', 'assigned', 'e0000000-0000-0000-0000-00000000000e', null, 'e0000000-0000-0000-0000-00000000000e');

insert into public.coverage_requests (id, circle_id, item_id, requester_id) values
  ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-00000000000a');

insert into public.assignment_requests (id, circle_id, item_id, assigner_id, assignee_id) values
  ('a1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a'),
  ('a1000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');

insert into public.updates (id, circle_id, author_id, body) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-00000000000a', 'Dad had a good day');

insert into public.comments (circle_id, item_id, author_id, body) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a6',
   'a0000000-0000-0000-0000-00000000000a', 'Thanks Bob');

insert into public.activity_events (circle_id, actor_id, type, item_id) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'completed',
   '00000000-0000-0000-0000-0000000000a5');

insert into public.notification_prefs (user_id, updates) values ('a0000000-0000-0000-0000-00000000000a', false);
insert into public.push_subscriptions (user_id, endpoint, keys) values
  ('a0000000-0000-0000-0000-00000000000a', 'https://push.example.test/alice', '{"p256dh": "k", "auth": "s"}');
insert into public.notifications (user_id, kind, line) values
  ('a0000000-0000-0000-0000-00000000000a', 'update_posted', 'Bob posted an update');
insert into public.outbox (id, circle_id, kind, payload, run_at) overriding system value values
  (900001, '10000000-0000-0000-0000-000000000001', 'push',
   '{"event": "update_posted", "recipient_id": "a0000000-0000-0000-0000-00000000000a"}', now() + interval '1 hour');

select public.save_google_connection('a0000000-0000-0000-0000-00000000000a', 'alice-refresh-token');
create temp table alice_secret on commit drop as
  select cs.google_secret_id as id, cs.feed_token as token
  from public.calendar_settings cs where cs.user_id = 'a0000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', 'public.delete_account(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.account_export(uuid)', 'execute'),
  'the service role (the account function) can delete and export'
);
select ok(
  not has_function_privilege('authenticated', 'public.delete_account(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.delete_account(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.account_export(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.account_export(uuid)', 'execute'),
  'the app can''t call them directly, so nobody can name someone else''s account'
);
select ok(
  not has_function_privilege('authenticated', 'public.release_items_for_departing_member(uuid, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.release_items_for_departing_member(uuid, uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.release_items_for_departing_member(uuid, uuid)', 'execute'),
  'releasing items is internal only'
);

-- Every foreign key to a person cascades or sets null, so deleting the
-- profile and auth.users row can't fail halfway.
select is_empty(
  $$ select con.conname from pg_constraint con
     join pg_namespace n on n.oid = con.connamespace
     where con.contype = 'f' and n.nspname = 'public'
       and con.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
       and con.confdeltype not in ('c', 'n') $$,
  'every foreign key to profiles or auth.users is on delete cascade or set null'
);

-- ---------------------------------------------------------------------------
-- account_export
-- ---------------------------------------------------------------------------

create temp table export on commit drop as
  select public.account_export('a0000000-0000-0000-0000-00000000000a') as data;

select is((select data #>> '{account,id}' from export), 'a0000000-0000-0000-0000-00000000000a', 'the export is Alice''s account');
select is((select data #>> '{profile,display_name}' from export), 'Alice Reyes', 'with her name');
select is((select data #>> '{membership,role}' from export), 'admin', 'her membership');
select is((select data #>> '{membership,care_recipient_name}' from export), 'Dad', 'and which circle');
select is((select data #>> '{notification_preferences,updates}' from export), 'false', 'her notification preferences');
select is((select data #>> '{calendar,google_calendar_connected}' from export), 'true', 'her calendar settings');
select is((select jsonb_array_length(data -> 'push_devices') from export), 1, 'her devices');
select is((select jsonb_array_length(data -> 'notifications') from export), 1, 'her notifications');
select is(
  (select array(select x ->> 'title' from jsonb_array_elements(data -> 'items_created') x order by x ->> 'title') from export),
  array['Laundry', 'Old errand', 'Pick up pills'],
  'the items she created, and only those'
);
select is((select data #>> '{updates,0,body}' from export), 'Dad had a good day', 'the updates she posted');
select is((select jsonb_array_length(data -> 'comments') from export), 1, 'her comments');
select is((select jsonb_array_length(data -> 'activity') from export), 1, 'her activity');
select ok(
  (select position('alice-refresh-token' in data::text) = 0
      and position((select token from alice_secret) in data::text) = 0
      and position('p256dh' in data::text) = 0
   from export),
  'no secrets: not the Google token, the feed token or push keys'
);
select is(public.account_export('f0000000-0000-0000-0000-00000000000f'), null, 'an unknown user has no export');

-- ---------------------------------------------------------------------------
-- delete_account: refusals
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.delete_account('90000000-0000-0000-0000-000000000009') $$,
  'invalid_input',
  'a demo guest can''t delete an account'
);
select throws_ok($$ select public.delete_account(null) $$, 'invalid_input', 'no user, no delete');

-- ---------------------------------------------------------------------------
-- delete_account: Alice
-- ---------------------------------------------------------------------------

create temp table outbox_before on commit drop as select coalesce(max(id), 0) as id from public.outbox where id < 900000;

select is(
  public.delete_account('a0000000-0000-0000-0000-00000000000a'),
  '{"google_refresh_token": "alice-refresh-token"}'::jsonb,
  'deleting Alice returns her Google token, for the function to revoke'
);

-- Calendar
select is_empty($$ select 1 from vault.secrets where id = (select id from alice_secret) $$,
  'her Google token is gone from Vault');
select is_empty($$ select 1 from public.calendar_settings where feed_token = (select token from alice_secret) $$,
  'her calendar feed link no longer works');

-- Released items
select results_eq(
  $$ select id, state, owner_id, proposed_assignee_id from public.items
     where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
                  '00000000-0000-0000-0000-0000000000a3') order by id $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'needs_someone'::text, null::uuid, null::uuid),
            ('00000000-0000-0000-0000-0000000000a2'::uuid, 'needs_someone'::text, null::uuid, null::uuid),
            ('00000000-0000-0000-0000-0000000000a3'::uuid, 'needs_someone'::text, null::uuid, null::uuid) $$,
  'what she owned, needed cover for, or was asked to take Needs someone again'
);
select is(
  (select array_agg(version order by id) from public.items
   where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
                '00000000-0000-0000-0000-0000000000a3')),
  array[2, 2, 2],
  'each released item''s version goes up, so stale screens refresh'
);
select is(
  (select status from public.coverage_requests where id = 'c1000000-0000-0000-0000-000000000001'),
  'cancelled',
  'her open coverage request is cancelled'
);
select is(
  (select status from public.assignment_requests where id = 'a1000000-0000-0000-0000-000000000003'),
  'withdrawn',
  'the request asking her is withdrawn'
);
select results_eq(
  $$ select i.state, i.proposed_assignee_id, r.status, r.assigner_id
     from public.items i join public.assignment_requests r on r.item_id = i.id
     where i.id = '00000000-0000-0000-0000-0000000000a4' $$,
  $$ values ('awaiting_acceptance'::text, 'b0000000-0000-0000-0000-00000000000b'::uuid, 'pending'::text, null::uuid) $$,
  'what she asked Bob to take still waits for Bob, asked by a former member'
);
select results_eq(
  $$ select state, owner_id, created_by from public.items where id = '00000000-0000-0000-0000-0000000000a5' $$,
  $$ values ('completed'::text, null::uuid, null::uuid) $$,
  'what she finished stays done, by a former member'
);
select results_eq(
  $$ select state, owner_id, version from public.items where id = '00000000-0000-0000-0000-0000000000a6' $$,
  $$ values ('assigned'::text, 'b0000000-0000-0000-0000-00000000000b'::uuid, 1) $$,
  'Bob''s item is untouched'
);
select results_eq(
  $$ select item_id, actor_id, data ->> 'previous_state' from public.activity_events
     where type = 'released' order by item_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, null::uuid, 'assigned'),
            ('00000000-0000-0000-0000-0000000000a2'::uuid, null::uuid, 'needs_coverage'),
            ('00000000-0000-0000-0000-0000000000a3'::uuid, null::uuid, 'awaiting_acceptance') $$,
  'each release is in the item''s history, by a former member'
);

-- The others are told
select results_eq(
  $$ select payload ->> 'item_id', payload ->> 'recipient_id' from public.outbox
     where kind = 'push' and payload ->> 'event' = 'item_released'
     order by 1, 2 $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-00000000000b'),
            ('00000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-00000000000c'),
            ('00000000-0000-0000-0000-0000000000a2', 'b0000000-0000-0000-0000-00000000000b'),
            ('00000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-00000000000c'),
            ('00000000-0000-0000-0000-0000000000a3', 'b0000000-0000-0000-0000-00000000000b'),
            ('00000000-0000-0000-0000-0000000000a3', 'c0000000-0000-0000-0000-00000000000c') $$,
  'everyone else in the circle is told about each released item'
);
select is(
  (select status from public.outbox where id = 900001),
  'done',
  'a notification still waiting for her is dropped'
);

-- Leaving the circle
select results_eq(
  $$ select user_id, role from public.circle_members
     where circle_id = '10000000-0000-0000-0000-000000000001' order by joined_at $$,
  $$ values ('b0000000-0000-0000-0000-00000000000b'::uuid, 'admin'::text),
            ('c0000000-0000-0000-0000-00000000000c'::uuid, 'member'::text) $$,
  'she was the only admin, so the longest-standing member, Bob, becomes admin'
);
select isnt_empty(
  $$ select 1 from public.activity_events
     where circle_id = '10000000-0000-0000-0000-000000000001' and type = 'member_left' and actor_id is null $$,
  'the circle''s history says a former member left'
);

-- Shared history stays, as "Former member"
select results_eq(
  $$ select body, author_id from public.updates where id = '11000000-0000-0000-0000-000000000001' $$,
  $$ values ('Dad had a good day'::text, null::uuid) $$,
  'her update stays for the family, by a former member'
);
select is_empty(
  $$ select 1 from public.comments where author_id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from public.activity_events where actor_id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from public.items where created_by = 'a0000000-0000-0000-0000-00000000000a' $$,
  'nothing in the shared history names her any more'
);
select is(
  (select count(*)::integer from public.comments where body = 'Thanks Bob' and author_id is null),
  1,
  'her comment stays too'
);

-- Her own data is gone
select is_empty(
  $$ select 1 from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from auth.users where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'her profile and auth.users row are deleted, so signing in again starts fresh'
);
select is_empty(
  $$ select 1 from public.push_subscriptions where user_id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from public.notification_prefs where user_id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from public.notifications where user_id = 'a0000000-0000-0000-0000-00000000000a'
     union all select 1 from public.circle_members where user_id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'her devices, preferences, notifications and membership are deleted'
);

-- Other circles
select results_eq(
  $$ select state, owner_id from public.items where id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('assigned'::text, 'e0000000-0000-0000-0000-00000000000e'::uuid) $$,
  'other circles are untouched'
);
select is(
  (select count(*)::integer from public.circles where id in (
    '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003')),
  2,
  'circle X carries on, and circle Z is untouched'
);
select is(
  (select count(*)::integer from public.outbox
   where id > (select id from outbox_before) and payload ->> 'recipient_id' = 'e0000000-0000-0000-0000-00000000000e'),
  0,
  'nobody in another circle is told'
);

-- Again
select is(
  public.delete_account('a0000000-0000-0000-0000-00000000000a'),
  '{"google_refresh_token": null}'::jsonb,
  'deleting again does nothing, so a retry is safe'
);

-- ---------------------------------------------------------------------------
-- delete_account: Dan, the only member of circle Y
-- ---------------------------------------------------------------------------

insert into public.items (circle_id, kind, title, starts_at, state, owner_id, created_by) values
  ('20000000-0000-0000-0000-000000000002', 'task', 'Dan''s job', now() + interval '1 day', 'assigned',
   'd0000000-0000-0000-0000-00000000000d', 'd0000000-0000-0000-0000-00000000000d');

select lives_ok($$ select public.delete_account('d0000000-0000-0000-0000-00000000000d') $$, 'Dan deletes his account');
select is_empty(
  $$ select 1 from public.circles where id = '20000000-0000-0000-0000-000000000002'
     union all select 1 from public.items where circle_id = '20000000-0000-0000-0000-000000000002' $$,
  'he was the only member, so the circle and its items are deleted with him'
);
select is_empty(
  $$ select 1 from public.outbox where circle_id = '20000000-0000-0000-0000-000000000002' $$,
  'with nobody left to tell'
);
select is(
  (select count(*)::integer from public.circle_members where circle_id = '30000000-0000-0000-0000-000000000003'),
  1,
  'Erin is still in her circle'
);

select * from finish();
rollback;
