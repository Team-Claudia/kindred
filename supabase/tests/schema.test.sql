-- Task 0.3: every table exists with RLS on, every RPC is a stub, and only the
-- right roles can call each one.
begin;
select plan(9);

select tables_are(
  'public',
  array[
    'profiles', 'circles', 'circle_members', 'invites', 'series', 'items',
    'assignment_requests', 'coverage_requests', 'updates', 'comments',
    'calendar_settings', 'push_subscriptions', 'notification_prefs',
    'notifications', 'activity_events', 'outbox'
  ],
  'public has exactly the plan §4.1 tables'
);

select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every table'
);

select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' $$,
  'no policies yet, so nothing is readable from the app'
);

select col_default_is(
  'public', 'circles', 'time_zone', 'America/Vancouver'::text,
  'circle time zone defaults to America/Vancouver'
);

-- The plan §4.2 RPCs. Later tasks may add helper functions alongside them.
create temporary table rpcs (name text) on commit drop;
insert into rpcs values
  ('create_circle'), ('create_invite'), ('join_circle'), ('leave_circle'), ('remove_member'),
  ('create_item'), ('update_item'), ('assign'), ('accept_assignment'), ('decline_assignment'),
  ('withdraw_assignment'), ('claim'), ('complete_item'), ('cancel_item'), ('coverage_remaining'),
  ('request_coverage'), ('cancel_coverage'), ('accept_coverage'), ('post_update'),
  ('mark_notifications_read'), ('log_share'), ('join_demo_circle'), ('reset_demo_circle'),
  ('weekly_summary');

select is_empty(
  $$ select name from rpcs
     except
     select p.proname::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' $$,
  'every plan §4.2 RPC exists'
);

select throws_ok(
  $$ select public.claim(gen_random_uuid(), 1) $$,
  'P0001', 'not_implemented',
  'RPC stubs raise not_implemented'
);

select is_empty(
  $$ select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot call any function'
);

select is_empty(
  $$ select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (select name from rpcs)
       and p.proname <> 'reset_demo_circle'
       and not has_function_privilege('authenticated', p.oid, 'execute') $$,
  'signed-in users can call every app RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.reset_demo_circle()', 'execute')
    and has_function_privilege('service_role', 'public.reset_demo_circle()', 'execute'),
  'only the service role can reset the demo circle'
);

select * from finish();
rollback;
