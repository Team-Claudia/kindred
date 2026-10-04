-- Task 4.5e: account export and deletion (PRD US 1.3, ADR-015).
--
-- The account Edge Function checks the member's JWT and calls one of these
-- with the service role:
--
-- - account_export(user_id): a JSON copy of the member's own data and the
--   content they authored.
-- - delete_account(user_id): deletes the account in one transaction, in the
--   ADR-015 order, so it either all happens or none of it does. Returns the
--   Google refresh token it removed (if any), so the function can also revoke
--   it with Google once the database is done.
--
-- release_items_for_departing_member() is the step that hands back the
-- member's open items. It's internal only.
--
-- Every foreign key to profiles is either `on delete cascade` (the member's
-- own rows: membership, settings, preferences, push subscriptions,
-- notifications) or `on delete set null` (shared history: items, requests,
-- updates, comments, activity, invites, series). So once the open items are
-- released, deleting the profile can't fail, and the null author or actor is
-- what the app shows as "Former member".

-- ---------------------------------------------------------------------------
-- release_items_for_departing_member: every open item in the circle that the
-- member is on goes back to Needs someone, and everyone else in the circle is
-- told (push event item_released). That's items they own (Assigned, or Needs
-- coverage, whose open coverage request is cancelled) and items they were
-- asked to take (Awaiting acceptance, whose pending request is withdrawn).
-- Items they asked someone else to take, and closed items, are left alone.
-- Returns how many items were released.
-- ---------------------------------------------------------------------------

create function public.release_items_for_departing_member(circle_id uuid, member_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_others uuid[];
  v_old public.items;
  v_new public.items;
  v_count integer := 0;
begin
  select coalesce(array_agg(cm.user_id), '{}') into v_others
  from public.circle_members cm
  where cm.circle_id = release_items_for_departing_member.circle_id
    and cm.user_id <> release_items_for_departing_member.member_id;

  for v_old in
    select i.* from public.items i
    where i.circle_id = release_items_for_departing_member.circle_id
      and (
        (i.state in ('assigned', 'needs_coverage')
          and i.owner_id = release_items_for_departing_member.member_id)
        or (i.state = 'awaiting_acceptance'
          and i.proposed_assignee_id = release_items_for_departing_member.member_id)
      )
    order by i.starts_at, i.id
    for update
  loop
    update public.assignment_requests r
    set status = 'withdrawn', resolved_at = now()
    where r.item_id = v_old.id and r.status = 'pending';

    update public.coverage_requests c
    set status = 'cancelled', resolved_at = now()
    where c.item_id = v_old.id and c.status = 'open';

    update public.items i
    set state = 'needs_someone',
        owner_id = null,
        proposed_assignee_id = null,
        version = i.version + 1,
        updated_at = now()
    where i.id = v_old.id
    returning i.* into v_new;

    perform public.log_item_event(v_new, release_items_for_departing_member.member_id, 'released',
      jsonb_build_object('previous_state', v_old.state));
    perform public.queue_push(v_new, release_items_for_departing_member.member_id, 'item_released', v_others);

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- delete_account (ADR-015). Service role only. In order:
-- 1. The calendar_settings row goes: the 4.5a trigger deletes the Google
--    token from Vault, and the calendar feed token stops working.
-- 2. If they're in a circle: their open items are released (above), they
--    leave it as leave_circle does, and after_member_left() makes the
--    longest-standing remaining member an admin if they were the only one,
--    or deletes the circle if they were the only member.
-- 3. Jobs still waiting to notify them are dropped.
-- 4. The profile and the auth.users row are deleted. Their push
--    subscriptions, preferences and notifications cascade; authors and actors
--    on shared history are set to null ("Former member").
--
-- Demo guests (anonymous) are refused with invalid_input; the nightly
-- clean-up deletes them. An unknown user_id does nothing, so a retry after a
-- lost reply is harmless. Returns {"google_refresh_token": text or null}.
-- ---------------------------------------------------------------------------

create function public.delete_account(user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := delete_account.user_id;
  v_token text;
  v_circle uuid;
begin
  if v_user is null then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from auth.users u where u.id = v_user and u.is_anonymous) then
    raise exception 'invalid_input';
  end if;

  -- Hold the profile while deleting, as request_coverage does when counting.
  perform 1 from public.profiles p where p.id = v_user for update;

  -- 1. Google token and calendar feed.
  select s.decrypted_secret into v_token
  from public.calendar_settings cs
  join vault.decrypted_secrets s on s.id = cs.google_secret_id
  where cs.user_id = v_user;

  delete from public.calendar_settings cs where cs.user_id = v_user;

  -- 2. Open items, then the circle, as leave_circle does.
  select cm.circle_id into v_circle from public.circle_members cm where cm.user_id = v_user;
  if v_circle is not null then
    perform 1 from public.circles c where c.id = v_circle for update;

    perform public.release_items_for_departing_member(v_circle, v_user);

    delete from public.circle_members cm where cm.circle_id = v_circle and cm.user_id = v_user;

    insert into public.activity_events (circle_id, actor_id, type)
    values (v_circle, v_user, 'member_left');

    perform public.after_member_left(v_circle);
  end if;

  -- 3. Nothing more to tell them.
  update public.outbox o
  set status = 'done', last_error = 'account_deleted'
  where o.status = 'pending' and o.payload ->> 'recipient_id' = v_user::text;

  -- 4. The account. Deleting the profile sets authors and actors to null.
  delete from public.profiles p where p.id = v_user;
  delete from auth.users u where u.id = v_user;

  return jsonb_build_object('google_refresh_token', v_token);
end $$;

-- ---------------------------------------------------------------------------
-- account_export (ADR-015). Service role only. Everything Kindred holds about
-- the member: their account and profile, settings, notification preferences,
-- devices, in-app notifications and membership, and the content they authored
-- in any circle: items they created, updates and comments they posted, and
-- their activity. Secrets (the feed token, the Google token, push keys) are
-- left out. Null if there is no such user.
-- ---------------------------------------------------------------------------

create function public.account_export(user_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'created_at', u.created_at
    ),
    'profile', (
      select jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at)
      from public.profiles p where p.id = u.id
    ),
    'membership', (
      select jsonb_build_object(
        'circle_id', cm.circle_id,
        'care_recipient_name', c.care_recipient_name,
        'time_zone', c.time_zone,
        'role', cm.role,
        'relationship', cm.relationship,
        'joined_at', cm.joined_at
      )
      from public.circle_members cm
      join public.circles c on c.id = cm.circle_id
      where cm.user_id = u.id
    ),
    'notification_preferences', (
      select to_jsonb(np) - 'user_id' from public.notification_prefs np where np.user_id = u.id
    ),
    'calendar', (
      select jsonb_build_object(
        'feed_appointments', cs.feed_appointments,
        'feed_tasks', cs.feed_tasks,
        'google_calendar_connected', cs.google_secret_id is not null
      )
      from public.calendar_settings cs where cs.user_id = u.id
    ),
    'push_devices', coalesce((
      select jsonb_agg(jsonb_build_object('created_at', ps.created_at) order by ps.created_at)
      from public.push_subscriptions ps where ps.user_id = u.id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', n.kind, 'item_id', n.item_id, 'line', n.line,
        'created_at', n.created_at, 'read_at', n.read_at
      ) order by n.created_at, n.id)
      from public.notifications n where n.user_id = u.id
    ), '[]'::jsonb),
    'items_created', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'circle_id', i.circle_id, 'kind', i.kind, 'title', i.title,
        'starts_at', i.starts_at, 'ends_at', i.ends_at, 'location', i.location,
        'private_notes', i.private_notes, 'state', i.state, 'created_at', i.created_at
      ) order by i.created_at, i.id)
      from public.items i where i.created_by = u.id
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', up.id, 'circle_id', up.circle_id, 'item_id', up.item_id,
        'body', up.body, 'created_at', up.created_at
      ) order by up.created_at, up.id)
      from public.updates up where up.author_id = u.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', co.id, 'item_id', co.item_id, 'body', co.body, 'created_at', co.created_at
      ) order by co.created_at, co.id)
      from public.comments co where co.author_id = u.id
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', a.type, 'circle_id', a.circle_id, 'item_id', a.item_id,
        'data', a.data, 'at', a.at
      ) order by a.at, a.id)
      from public.activity_events a where a.actor_id = u.id
    ), '[]'::jsonb)
  )
  from auth.users u
  where u.id = account_export.user_id
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.release_items_for_departing_member(uuid, uuid),
  public.delete_account(uuid),
  public.account_export(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.delete_account(uuid),
  public.account_export(uuid)
to service_role;
