-- Task 2.3: live updates between phones (plan §4.3, ADR-014).
--
-- Each signed-in app listens on one Realtime channel per circle and refreshes
-- its data when these tables change. Realtime only sends postgres_changes for
-- tables in the supabase_realtime publication. It checks each change against
-- the table's select policy for the listening member, so the existing
-- "<table>_select_own_circle" policies (circle_id = current_circle_id()) keep
-- every member to their own circle's changes.

do $$
declare
  t text;
begin
  -- Supabase creates this publication; create it if an environment hasn't.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- Skip a table that's already in it (e.g. switched on from the dashboard).
  foreach t in array array['items', 'activity_events', 'coverage_requests', 'updates'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
