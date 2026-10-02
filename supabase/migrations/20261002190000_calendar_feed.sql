-- Task 3.4: the personal calendar feed (ADR-008, PRD US 5.2 and 8.3).
--
-- Each member has a secret link, /cal/<feed_token>.ics, that their calendar
-- app subscribes to. The calendar-feed Edge Function serves it without a
-- sign-in, reading the member's items through calendar_feed_for_token with the
-- service role.
--
-- calendar_settings rows don't exist until a member first asks for their link,
-- and the app can't write tables, so calendar_feed() creates the caller's row
-- on first use.

-- ---------------------------------------------------------------------------
-- calendar_feed: the caller's feed token and whether tasks are included,
-- creating their calendar_settings row (with a new random token) if missing.
-- ---------------------------------------------------------------------------

create function public.calendar_feed()
returns table (token text, feed_tasks boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;

  -- calendar_settings.user_id references profiles; make sure the caller has one.
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.calendar_settings (user_id) values (v_user)
  on conflict (user_id) do nothing;

  return query
    select cs.feed_token, cs.feed_tasks
    from public.calendar_settings cs
    where cs.user_id = v_user;
end $$;

-- ---------------------------------------------------------------------------
-- set_calendar_feed_tasks: turns tasks in the caller's feed on or off (US 5.2:
-- appointments are in by default, tasks aren't). Returns the same as
-- calendar_feed(). The argument isn't called feed_tasks because that's the
-- name of a returned column.
-- ---------------------------------------------------------------------------

create function public.set_calendar_feed_tasks(enabled boolean)
returns table (token text, feed_tasks boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;
  if set_calendar_feed_tasks.enabled is null then
    raise exception 'invalid_input';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.calendar_settings as cs (user_id, feed_tasks)
  values (v_user, set_calendar_feed_tasks.enabled)
  on conflict (user_id) do update set feed_tasks = excluded.feed_tasks;

  return query
    select cs.feed_token, cs.feed_tasks
    from public.calendar_settings cs
    where cs.user_id = v_user;
end $$;

-- ---------------------------------------------------------------------------
-- calendar_feed_for_token: everything the calendar-feed function needs for
-- one feed, or null if no member has that token. Service role only.
--
-- Returns {"care_recipient_name", "time_zone", "items": [{id, kind, state, title,
-- starts_at, ends_at, updated_at, version}]}. Items are the ones the member
-- owns in their current circle and has accepted: Assigned, or Needs coverage
-- (still theirs until someone takes it). Awaiting acceptance (BR-05),
-- Completed and Cancelled are left out, so a handed-off or cancelled item
-- leaves the feed. Appointments if feed_appointments is on, tasks if
-- feed_tasks is on, from 30 days ago to a year ahead. Never notes, location or
-- updates (US 5.2). A member with no circle gets an empty feed.
-- ---------------------------------------------------------------------------

create function public.calendar_feed_for_token(token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_settings public.calendar_settings;
  v_circle public.circles;
begin
  select cs.* into v_settings
  from public.calendar_settings cs
  where cs.feed_token = calendar_feed_for_token.token;
  if not found then
    return null;
  end if;

  select c.* into v_circle
  from public.circles c
  join public.circle_members cm on cm.circle_id = c.id
  where cm.user_id = v_settings.user_id;

  return jsonb_build_object(
    'care_recipient_name', v_circle.care_recipient_name,
    'time_zone', coalesce(v_circle.time_zone, 'America/Vancouver'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'kind', i.kind,
        'state', i.state,
        'title', i.title,
        'starts_at', i.starts_at,
        'ends_at', i.ends_at,
        'updated_at', i.updated_at,
        'version', i.version
      ) order by i.starts_at, i.id)
      from public.items i
      where i.circle_id = v_circle.id
        and i.owner_id = v_settings.user_id
        and i.state in ('assigned', 'needs_coverage')
        and (
          (i.kind = 'appointment' and v_settings.feed_appointments)
          or (i.kind = 'task' and v_settings.feed_tasks)
        )
        and i.starts_at >= now() - interval '30 days'
        and i.starts_at < now() + interval '1 year'
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function
  public.calendar_feed(),
  public.set_calendar_feed_tasks(boolean),
  public.calendar_feed_for_token(text)
from public, anon, authenticated;

grant execute on function
  public.calendar_feed(),
  public.set_calendar_feed_tasks(boolean)
to authenticated;

grant execute on function public.calendar_feed_for_token(text) to service_role;
