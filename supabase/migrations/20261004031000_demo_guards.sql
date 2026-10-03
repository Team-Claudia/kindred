-- Task 4.2: keep Try the demo guests in the sample circle.
--
-- A guest is an anonymous sign-in, and is only ever in the sample circle
-- (BR-12, plan §8.5). Without these guards a guest could reach a real
-- family's circle: signing in with Try the demo on the way to an invite link
-- and then calling join_circle, or start a circle of their own with
-- create_circle, or invite real accounts into the sample circle with
-- create_invite.
--
-- Rather than repeat the check in each RPC, two triggers refuse the rows those
-- RPCs write when the caller's token says is_anonymous:
--
-- - circle_members: a guest may join only the sample circle (which is what
--   join_demo_circle does), so create_circle and join_circle raise
--   invalid_input for guests.
-- - invites: guests can't make invite codes, so create_invite raises
--   invalid_input.
--
-- Rows written with no token (migrations, build_sample_circle run by the
-- service role or pg_cron, tests set up as postgres) aren't affected.

create function public.is_anonymous_caller()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create function public.refuse_guest_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_anonymous_caller() and new.circle_id <> '5a3b1e00-0000-4000-8000-000000000100' then
    raise exception 'invalid_input';
  end if;
  return new;
end $$;

create trigger circle_members_refuse_guests
  before insert or update of circle_id on public.circle_members
  for each row execute function public.refuse_guest_membership();

create function public.refuse_guest_invite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_anonymous_caller() then
    raise exception 'invalid_input';
  end if;
  return new;
end $$;

create trigger invites_refuse_guests
  before insert on public.invites
  for each row execute function public.refuse_guest_invite();

revoke execute on function
  public.is_anonymous_caller(),
  public.refuse_guest_membership(),
  public.refuse_guest_invite()
from public, anon, authenticated;
