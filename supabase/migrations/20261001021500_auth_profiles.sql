-- Task 1.1: sign-in (ADR-004).
--
-- Every auth.users row gets a profiles row. Supabase Auth reuses the same
-- auth.users row when someone signs in again with the same Google account or
-- email, so the trigger only fires for new accounts; on conflict do nothing
-- keeps it safe if it ever runs twice for the same id.

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Google sends the name as full_name and name; email sign-ins send neither.
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Only the trigger runs this; no one can call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed in before this migration.
insert into public.profiles (id, display_name)
select u.id, nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), '')
from auth.users u
on conflict (id) do nothing;

-- The sign-in guard asks "is this person in a circle?", so each member can read
-- their own membership row. Task 1.2 adds the circle-wide read policies.
create policy circle_members_select_own
  on public.circle_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));
