-- Task 2.3: the tables the circle's Realtime channel listens to are published,
-- and each has a select policy, so members only receive their own circle's
-- changes.
begin;
select plan(2);

select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename in ('items', 'activity_events', 'coverage_requests', 'updates') $$,
  array['items', 'activity_events', 'coverage_requests', 'updates'],
  'items, activity_events, coverage_requests and updates are in the supabase_realtime publication'
);

select set_eq(
  $$ select tablename::text from pg_policies
     where schemaname = 'public' and cmd = 'SELECT'
       and qual like '%current_circle_id()%'
       and tablename in ('items', 'activity_events', 'coverage_requests', 'updates') $$,
  array['items', 'activity_events', 'coverage_requests', 'updates'],
  'each published table has a select policy limited to the member''s own circle'
);

select * from finish();
rollback;
