-- Task 4.5a: Google Calendar connect and "Who's free?" (ADR-008, PRD US 5.1,
-- 6.1, 6.2, BR-04).
--
-- A member connects Google Calendar through the google-oauth Edge Function,
-- which asks Google for the free/busy scope only. The refresh token goes into
-- Supabase Vault, encrypted; calendar_settings.google_secret_id holds the
-- secret's ID. The availability Edge Function reads the tokens of the
-- caller's circle with the service role and asks Google whether each member is
-- free or busy. Nothing about events is ever stored.
--
-- The app can't read calendar_settings (RLS, no policies), so it asks
-- google_calendar_connected() and disconnects with disconnect_google_calendar().

-- ---------------------------------------------------------------------------
-- The Vault secret goes with the connection: whenever google_secret_id is
-- cleared or replaced, or the row is deleted (an account deleted, so its
-- profile and settings cascade), the old secret is deleted too.
-- ---------------------------------------------------------------------------

create function public.calendar_settings_drop_google_secret()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.google_secret_id is not null
     and (tg_op = 'DELETE' or new.google_secret_id is distinct from old.google_secret_id) then
    delete from vault.secrets s where s.id = old.google_secret_id;
  end if;
  return null;
end $$;

create trigger calendar_settings_drop_google_secret
  after update of google_secret_id or delete on public.calendar_settings
  for each row
  execute function public.calendar_settings_drop_google_secret();

-- ---------------------------------------------------------------------------
-- save_google_connection: stores a member's Google refresh token in Vault and
-- points their calendar_settings row at it, replacing any earlier connection.
-- Service role only, for the google-oauth function once Google has sent the
-- member back. Creates the profile and settings rows if missing.
-- ---------------------------------------------------------------------------

create function public.save_google_connection(user_id uuid, refresh_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_secret uuid;
begin
  if save_google_connection.user_id is null
     or coalesce(btrim(save_google_connection.refresh_token), '') = '' then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from auth.users u where u.id = save_google_connection.user_id) then
    raise exception 'not_member';
  end if;

  insert into public.profiles (id) values (save_google_connection.user_id)
  on conflict (id) do nothing;

  -- No name: Vault names are unique, and a new secret per connection avoids
  -- clashing with one left over from an earlier connection.
  v_secret := vault.create_secret(
    save_google_connection.refresh_token,
    null,
    'Kindred: Google Calendar free/busy refresh token'
  );

  -- Replacing the ID deletes the old secret (trigger above).
  insert into public.calendar_settings as cs (user_id, google_secret_id)
  values (save_google_connection.user_id, v_secret)
  on conflict (user_id) do update set google_secret_id = excluded.google_secret_id;
end $$;

-- ---------------------------------------------------------------------------
-- google_calendar_connected: whether the caller has connected Google
-- Calendar, for Care Circle and settings.
-- ---------------------------------------------------------------------------

create function public.google_calendar_connected()
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;

  return exists (
    select 1 from public.calendar_settings cs
    where cs.user_id = v_user and cs.google_secret_id is not null
  );
end $$;

-- ---------------------------------------------------------------------------
-- disconnect_google_calendar: forgets the caller's Google connection. The
-- refresh token is deleted from Vault (trigger above), so Kindred can no
-- longer ask Google anything, and the member shows as Unknown. Doing it again
-- does nothing.
-- ---------------------------------------------------------------------------

create function public.disconnect_google_calendar()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;

  update public.calendar_settings cs
  set google_secret_id = null
  where cs.user_id = v_user and cs.google_secret_id is not null;
end $$;

-- ---------------------------------------------------------------------------
-- availability_tokens: one row per member of circle_id, with their Google
-- refresh token, or null if they haven't connected. Service role only, for
-- the availability function, which passes the signed-in caller as caller_id:
-- raises not_member unless the caller is in that circle, so a member only
-- ever learns about their own circle.
-- ---------------------------------------------------------------------------

create function public.availability_tokens(circle_id uuid, caller_id uuid)
returns table (member_id uuid, refresh_token text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.circle_members cm
    where cm.circle_id = availability_tokens.circle_id
      and cm.user_id = availability_tokens.caller_id
  ) then
    raise exception 'not_member';
  end if;

  return query
    select cm.user_id, s.decrypted_secret
    from public.circle_members cm
    left join public.calendar_settings cs on cs.user_id = cm.user_id
    left join vault.decrypted_secrets s on s.id = cs.google_secret_id
    where cm.circle_id = availability_tokens.circle_id
    order by cm.user_id;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.calendar_settings_drop_google_secret(),
  public.save_google_connection(uuid, text),
  public.google_calendar_connected(),
  public.disconnect_google_calendar(),
  public.availability_tokens(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.google_calendar_connected(),
  public.disconnect_google_calendar()
to authenticated;

grant execute on function
  public.save_google_connection(uuid, text),
  public.availability_tokens(uuid, uuid)
to service_role;
