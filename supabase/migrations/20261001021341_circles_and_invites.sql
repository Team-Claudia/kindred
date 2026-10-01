-- Task 1.2: Care Circles, invites and joining (PRD Epics 2 and 3, ADR-005,
-- ADR-011).
--
-- - current_circle_id(): the caller's one circle (BR-12), used by RLS.
-- - RLS select policies so members read only their own circle.
-- - The circle RPCs: create_circle, create_invite, join_circle, leave_circle,
--   remove_member, set_admin, plus invite_preview for the /join/:code screen.
--
-- create_circle and join_circle gain an optional display_name, so the name the
-- member types during setup is saved in the same call that creates their
-- membership.

-- ---------------------------------------------------------------------------
-- The caller's circle
-- ---------------------------------------------------------------------------

-- Security definer so RLS policies on circle_members can call it without
-- recursing into themselves.
create function public.current_circle_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select cm.circle_id from public.circle_members cm where cm.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security: members read their own circle only (BR-07)
--
-- Select only. There are no insert/update/delete policies, so clients can't
-- write; every change goes through an RPC below or in a later task.
-- outbox is left without a policy: it's for the background worker only.
-- ---------------------------------------------------------------------------

create policy circles_select_own_circle on public.circles
  for select to authenticated
  using (id = (select public.current_circle_id()));

create policy circle_members_select_own_circle on public.circle_members
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy invites_select_own_circle on public.invites
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy series_select_own_circle on public.series
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy items_select_own_circle on public.items
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy assignment_requests_select_own_circle on public.assignment_requests
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy coverage_requests_select_own_circle on public.coverage_requests
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy updates_select_own_circle on public.updates
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy comments_select_own_circle on public.comments
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

create policy activity_events_select_own_circle on public.activity_events
  for select to authenticated
  using (circle_id = (select public.current_circle_id()));

-- Your own profile, and the profiles of people in your circle (for names).
create policy profiles_select_self_or_circle on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.circle_members cm
      where cm.user_id = profiles.id
        and cm.circle_id = (select public.current_circle_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------

-- Creates the caller's profile if it doesn't exist yet, and saves their name
-- when one is given.
create function public.save_profile(user_id uuid, display_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := nullif(btrim(save_profile.display_name), '');
begin
  if v_name is not null and char_length(v_name) > 80 then
    raise exception 'invalid_input';
  end if;

  insert into public.profiles as p (id, display_name)
  values (save_profile.user_id, v_name)
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, p.display_name);
end $$;

-- Trims a relationship and checks its length; null if blank.
create function public.clean_relationship(relationship text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_relationship text := nullif(btrim(clean_relationship.relationship), '');
begin
  if v_relationship is not null and char_length(v_relationship) > 40 then
    raise exception 'invalid_input';
  end if;
  return v_relationship;
end $$;

-- ---------------------------------------------------------------------------
-- RPCs. The 0.3 stubs for create_circle and join_circle are dropped and
-- recreated because their argument lists change; the others are replaced in
-- place and keep their grants.
-- ---------------------------------------------------------------------------

drop function public.create_circle(text, text, text);
drop function public.join_circle(text, text);

-- US 2.1: the creator becomes the circle's first admin.
create function public.create_circle(
  care_recipient_name text,
  relationship text,
  time_zone text,
  display_name text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(create_circle.care_recipient_name), '');
  v_time_zone text := coalesce(nullif(btrim(create_circle.time_zone), ''), 'America/Vancouver');
  v_relationship text := public.clean_relationship(create_circle.relationship);
  v_circle uuid;
begin
  if v_user is null then
    raise exception 'not_member';
  end if;
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = v_time_zone) then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from public.circle_members cm where cm.user_id = v_user) then
    raise exception 'already_in_circle'; -- BR-12
  end if;

  perform public.save_profile(v_user, create_circle.display_name);

  insert into public.circles (care_recipient_name, time_zone)
  values (v_name, v_time_zone)
  returning id into v_circle;

  begin
    insert into public.circle_members (circle_id, user_id, role, relationship)
    values (v_circle, v_user, 'admin', v_relationship);
  exception when unique_violation then
    -- Another call made this user a member in the meantime (BR-12).
    raise exception 'already_in_circle';
  end;

  insert into public.activity_events (circle_id, actor_id, type)
  values (v_circle, v_user, 'circle_created');

  return v_circle;
end $$;

-- ADR-011: a random 8-character code that works for 14 days. Any member can
-- invite (US 2.2).
create or replace function public.create_invite()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  -- No 0/O, 1/l/I, so a code read aloud or retyped still works.
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_circle uuid := public.current_circle_id();
  v_bytes bytea;
  v_code text;
  v_inserted integer;
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;

  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;

    insert into public.invites (code, circle_id, created_by)
    values (v_code, v_circle, auth.uid())
    on conflict (code) do nothing;
    get diagnostics v_inserted = row_count;
    exit when v_inserted = 1;
  end loop;

  return v_code;
end $$;

-- US 3.1, ADR-011. Idempotent for members of the invite's circle, who get
-- their circle back even if the link has since expired.
create function public.join_circle(
  code text,
  relationship text default null,
  display_name text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites;
  v_current uuid;
  v_relationship text := public.clean_relationship(join_circle.relationship);
begin
  if v_user is null then
    raise exception 'not_member';
  end if;

  select * into v_invite from public.invites i where i.code = join_circle.code;
  if not found then
    raise exception 'invite_not_found';
  end if;

  select cm.circle_id into v_current from public.circle_members cm where cm.user_id = v_user;
  if v_current = v_invite.circle_id then
    return v_current;
  elsif v_current is not null then
    raise exception 'already_in_other_circle'; -- BR-12
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  perform public.save_profile(v_user, join_circle.display_name);

  begin
    insert into public.circle_members (circle_id, user_id, role, relationship)
    values (v_invite.circle_id, v_user, 'member', v_relationship);
  exception when unique_violation then
    -- A second join raced this one. Same circle: fine. Another: BR-12.
    select cm.circle_id into v_current from public.circle_members cm where cm.user_id = v_user;
    if v_current = v_invite.circle_id then
      return v_current;
    end if;
    raise exception 'already_in_other_circle';
  end;

  insert into public.activity_events (circle_id, actor_id, type)
  values (v_invite.circle_id, v_user, 'member_joined');

  return v_invite.circle_id;
end $$;

-- After a member leaves or is removed: if no admin is left, make the
-- longest-standing remaining member an admin (US 2.2). If nobody is left,
-- delete the circle, since no one could ever reach its data again.
create function public.after_member_left(circle_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.circle_members cm where cm.circle_id = after_member_left.circle_id
  ) then
    delete from public.circles c where c.id = after_member_left.circle_id;
    return;
  end if;

  if not exists (
    select 1 from public.circle_members cm
    where cm.circle_id = after_member_left.circle_id and cm.role = 'admin'
  ) then
    update public.circle_members cm
    set role = 'admin'
    where cm.circle_id = after_member_left.circle_id
      and cm.user_id = (
        select oldest.user_id from public.circle_members oldest
        where oldest.circle_id = after_member_left.circle_id
        order by oldest.joined_at, oldest.user_id
        limit 1
      );

    insert into public.activity_events (circle_id, actor_id, type, data)
    select after_member_left.circle_id, null, 'admin_added', json_build_object('member_id', cm.user_id)::jsonb
    from public.circle_members cm
    where cm.circle_id = after_member_left.circle_id and cm.role = 'admin';
  end if;
end $$;

create or replace function public.leave_circle()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_circle uuid := public.current_circle_id();
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;

  -- Serialise membership changes in this circle, so two admins leaving at
  -- once still leave someone in charge.
  perform 1 from public.circles c where c.id = v_circle for update;

  delete from public.circle_members cm where cm.circle_id = v_circle and cm.user_id = v_user;

  insert into public.activity_events (circle_id, actor_id, type)
  values (v_circle, v_user, 'member_left');

  perform public.after_member_left(v_circle);
end $$;

-- member_id is the member's user ID (circle_members.user_id). Admins remove
-- others; to remove yourself, leave.
create or replace function public.remove_member(member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_circle uuid := public.current_circle_id();
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;

  perform 1 from public.circles c where c.id = v_circle for update;

  if not exists (
    select 1 from public.circle_members cm
    where cm.circle_id = v_circle and cm.user_id = v_user and cm.role = 'admin'
  ) then
    raise exception 'not_admin';
  end if;
  if remove_member.member_id = v_user then
    raise exception 'invalid_input';
  end if;

  delete from public.circle_members cm
  where cm.circle_id = v_circle and cm.user_id = remove_member.member_id;
  if not found then
    raise exception 'not_member';
  end if;

  insert into public.activity_events (circle_id, actor_id, type, data)
  values (v_circle, v_user, 'member_removed', json_build_object('member_id', remove_member.member_id)::jsonb);

  perform public.after_member_left(v_circle);
end $$;

-- Makes another member of your circle an admin (wireframe 06). Admin only.
-- A circle may have several admins (US 2.2).
create function public.set_admin(member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_circle uuid := public.current_circle_id();
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;
  if not exists (
    select 1 from public.circle_members cm
    where cm.circle_id = v_circle and cm.user_id = v_user and cm.role = 'admin'
  ) then
    raise exception 'not_admin';
  end if;

  update public.circle_members cm
  set role = 'admin'
  where cm.circle_id = v_circle and cm.user_id = set_admin.member_id and cm.role <> 'admin';

  if found then
    insert into public.activity_events (circle_id, actor_id, type, data)
    values (v_circle, v_user, 'admin_added', json_build_object('member_id', set_admin.member_id)::jsonb);
  elsif not exists (
    select 1 from public.circle_members cm
    where cm.circle_id = v_circle and cm.user_id = set_admin.member_id
  ) then
    raise exception 'not_member';
  end if;
end $$;

-- What the /join/:code screen shows before the visitor has joined or signed
-- in (wireframe 07): only the care recipient's name, first names, the member
-- count and the expiry. Signed-in visitors also learn whether they're already
-- in this circle or another one, so the screen can explain BR-12 up front.
create function public.invite_preview(code text)
returns table (
  care_recipient_name text,
  inviter_name text, -- first name; null if they've left Kindred
  member_names text[], -- first names of up to five members, longest-standing first
  member_count integer,
  expires_at timestamptz,
  is_member boolean,
  in_other_circle boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invite public.invites;
  v_current uuid;
begin
  select * into v_invite from public.invites i where i.code = invite_preview.code;
  if not found then
    raise exception 'invite_not_found';
  end if;

  if auth.uid() is not null then
    select cm.circle_id into v_current from public.circle_members cm where cm.user_id = auth.uid();
  end if;

  if v_invite.expires_at <= now() and v_current is distinct from v_invite.circle_id then
    raise exception 'invite_expired';
  end if;

  return query
  select
    c.care_recipient_name,
    (select split_part(btrim(p.display_name), ' ', 1)
       from public.profiles p where p.id = v_invite.created_by),
    coalesce((
      select array_agg(m.first_name order by m.joined_at, m.user_id)
      from (
        select split_part(btrim(p.display_name), ' ', 1) as first_name, cm.joined_at, cm.user_id
        from public.circle_members cm
        join public.profiles p on p.id = cm.user_id
        where cm.circle_id = c.id and nullif(btrim(p.display_name), '') is not null
        order by cm.joined_at, cm.user_id
        limit 5
      ) m
    ), '{}'::text[]),
    (select count(*)::integer from public.circle_members cm where cm.circle_id = c.id),
    v_invite.expires_at,
    coalesce(v_current = c.id, false),
    coalesce(v_current <> c.id, false)
  from public.circles c
  where c.id = v_invite.circle_id;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what (plan §4.2). New functions get EXECUTE for public by
-- default, so revoke it, then grant only what the app calls.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.current_circle_id(),
  public.save_profile(uuid, text),
  public.clean_relationship(text),
  public.create_circle(text, text, text, text),
  public.join_circle(text, text, text),
  public.after_member_left(uuid),
  public.set_admin(uuid),
  public.invite_preview(text)
from public, anon, authenticated;

-- RLS policies run as the caller, so signed-in users need current_circle_id().
grant execute on function
  public.current_circle_id(),
  public.create_circle(text, text, text, text),
  public.join_circle(text, text, text),
  public.set_admin(uuid),
  public.invite_preview(text)
to authenticated;

-- The invite screen is shown before sign-in.
grant execute on function public.invite_preview(text) to anon;
