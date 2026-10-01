-- Task 2.1: the assignment state machine (PRD §17, ADR-006).
--
-- Fills in the item RPC stubs from the initial migration: create_item,
-- update_item, assign, accept_assignment, decline_assignment,
-- withdraw_assignment, claim, complete_item and cancel_item. The coverage RPCs
-- are task 3.1 and stay stubs.
--
-- Every item RPC, in one transaction:
-- 1. locks the item row, checking the caller is in its circle (not_member);
-- 2. checks the state-specific error first, then the version, so a second
--    "I'll do it" raises already_claimed (with the owner's name), not
--    stale_version;
-- 3. applies the transition, bumps version and updated_at, and returns the
--    updated row;
-- 4. appends one activity_events row;
-- 5. queues a push outbox job for each member who should hear about it
--    (plan §4.4). Payloads carry IDs and an event name only, never titles or
--    notes (ADR-010).
--
-- The signatures don't change, so `create or replace` keeps the grants from
-- the initial migration.

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------

-- Locks an item for the rest of the transaction. Raises not_member if the item
-- doesn't exist or isn't in the caller's circle, so non-members learn nothing.
create function public.lock_item(id uuid)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items;
begin
  select i.* into v_item
  from public.items i
  where i.id = lock_item.id and i.circle_id = public.current_circle_id()
  for update;
  if not found then
    raise exception 'not_member';
  end if;
  return v_item;
end $$;

-- Whether a user is a member of the given circle.
create function public.is_circle_member(circle uuid, person uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = is_circle_member.circle and cm.user_id = is_circle_member.person
  )
$$;

-- DETAIL for errors that name someone: {"name": "..."}, or {} when the person
-- has no name or has left Kindred, so the app falls back to generic wording.
create function public.name_detail(person uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select json_build_object('name', btrim(p.display_name))::text
     from public.profiles p
     where p.id = name_detail.person and nullif(btrim(p.display_name), '') is not null),
    '{}'
  )
$$;

-- Appends one history row for an item.
create function public.log_item_event(item public.items, actor uuid, event_type text, data jsonb default '{}')
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_events (circle_id, actor_id, type, item_id, data)
  values (
    (log_item_event.item).circle_id,
    log_item_event.actor,
    log_item_event.event_type,
    (log_item_event.item).id,
    jsonb_strip_nulls(coalesce(log_item_event.data, '{}'))
  );
end $$;

-- Queues one push job per recipient (plan §4.4). Skips nulls, duplicates, the
-- member who made the change, and anyone no longer in the circle. The payload
-- is privacy-safe: IDs and an event name only (ADR-010).
create function public.queue_push(item public.items, actor uuid, event text, recipients uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.outbox (circle_id, kind, payload)
  select
    (queue_push.item).circle_id,
    'push',
    jsonb_build_object(
      'event', queue_push.event,
      'item_id', (queue_push.item).id,
      'recipient_id', r.id,
      'actor_id', queue_push.actor
    )
  from (select distinct u.id from unnest(queue_push.recipients) as u(id)) r
  where r.id is not null
    and r.id is distinct from queue_push.actor
    and public.is_circle_member((queue_push.item).circle_id, r.id);
end $$;

-- Checks and tidies the free-text fields shared by create_item and
-- update_item. Raises invalid_input on a blank or over-long title, a missing
-- start, an end before the start, or an over-long location or note.
create function public.check_item_fields(
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  private_notes text
)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if check_item_fields.title is null
     or char_length(check_item_fields.title) > 200
     or check_item_fields.starts_at is null
     or coalesce(check_item_fields.ends_at < check_item_fields.starts_at, false)
     or coalesce(char_length(check_item_fields.location) > 200, false)
     or coalesce(char_length(check_item_fields.private_notes) > 4000, false) then
    raise exception 'invalid_input';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- create_item (US 7.1). With no assignee the item Needs someone. Assigning
-- yourself counts as claiming (BR-03), so it goes straight to Assigned;
-- assigning someone else makes it Awaiting acceptance with a pending request.
-- ---------------------------------------------------------------------------

create or replace function public.create_item(
  kind text,
  title text,
  starts_at timestamptz,
  ends_at timestamptz default null,
  location text default null,
  private_notes text default null,
  assignee_id uuid default null,
  repeat text default null,
  until timestamptz default null,
  follow_up_of uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_circle uuid := public.current_circle_id();
  v_title text := nullif(btrim(create_item.title), '');
  v_location text := nullif(btrim(create_item.location), '');
  v_notes text := nullif(btrim(create_item.private_notes), '');
  v_self boolean := create_item.assignee_id is not distinct from v_user;
  v_item public.items;
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;

  if create_item.kind is null or create_item.kind not in ('task', 'appointment') then
    raise exception 'invalid_input';
  end if;
  perform public.check_item_fields(v_title, create_item.starts_at, create_item.ends_at, v_location, v_notes);

  if create_item.assignee_id is not null
     and not public.is_circle_member(v_circle, create_item.assignee_id) then
    raise exception 'invalid_input';
  end if;
  if create_item.follow_up_of is not null and not exists (
    select 1 from public.items i
    where i.id = create_item.follow_up_of and i.circle_id = v_circle
  ) then
    raise exception 'invalid_input';
  end if;

  -- Recurrence is task 4.5. Refuse rather than silently make a one-off.
  if create_item.repeat is not null or create_item.until is not null then
    raise exception 'not_implemented';
  end if;

  insert into public.items (
    circle_id, kind, title, starts_at, ends_at, location, private_notes,
    state, owner_id, proposed_assignee_id, follow_up_of, created_by
  )
  values (
    v_circle, create_item.kind, v_title, create_item.starts_at, create_item.ends_at,
    v_location, v_notes,
    case
      when create_item.assignee_id is null then 'needs_someone'
      when v_self then 'assigned'
      else 'awaiting_acceptance'
    end,
    case when create_item.assignee_id is not null and v_self then v_user end,
    case when create_item.assignee_id is not null and not v_self then create_item.assignee_id end,
    create_item.follow_up_of,
    v_user
  )
  returning * into v_item;

  if create_item.assignee_id is not null and not v_self then
    insert into public.assignment_requests (circle_id, item_id, assigner_id, assignee_id)
    values (v_circle, v_item.id, v_user, create_item.assignee_id);
  end if;

  perform public.log_item_event(v_item, v_user, 'created', jsonb_build_object(
    'kind', v_item.kind,
    'state', v_item.state,
    'assignee_id', create_item.assignee_id,
    'follow_up_of', v_item.follow_up_of
  ));

  if v_item.state = 'awaiting_acceptance' then
    perform public.queue_push(v_item, v_user, 'assignment_requested', array[create_item.assignee_id]);
  end if;

  return v_item.id;
end $$;

-- ---------------------------------------------------------------------------
-- update_item (US 7.7). patch may hold title, starts_at, ends_at, location and
-- private_notes; a key that's present but null clears that field (title and
-- starts_at can't be cleared). Completed and cancelled items can't be edited.
--
-- BR-11: if someone other than the owner changes the date or time of an
-- Assigned item, it returns to Awaiting acceptance for the same person, with a
-- new pending request. Any other edit keeps the owner, who is told about it.
-- ---------------------------------------------------------------------------

create or replace function public.update_item(item_id uuid, version integer, patch jsonb)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_new public.items;
  v_key text;
  v_fields text[] := '{}';
  v_reconfirm boolean;
begin
  v_item := public.lock_item(update_item.item_id);

  if v_item.state in ('completed', 'cancelled') then
    raise exception 'invalid_state';
  end if;
  if v_item.version is distinct from update_item.version then
    raise exception 'stale_version';
  end if;

  if jsonb_typeof(update_item.patch) is distinct from 'object' then
    raise exception 'invalid_input';
  end if;
  for v_key in select jsonb_object_keys(update_item.patch) loop
    if v_key not in ('title', 'starts_at', 'ends_at', 'location', 'private_notes') then
      raise exception 'invalid_input';
    end if;
  end loop;

  v_new := v_item;
  if update_item.patch ? 'title' then
    v_new.title := nullif(btrim(update_item.patch ->> 'title'), '');
  end if;
  if update_item.patch ? 'location' then
    v_new.location := nullif(btrim(update_item.patch ->> 'location'), '');
  end if;
  if update_item.patch ? 'private_notes' then
    v_new.private_notes := nullif(btrim(update_item.patch ->> 'private_notes'), '');
  end if;
  begin
    if update_item.patch ? 'starts_at' then
      v_new.starts_at := (update_item.patch ->> 'starts_at')::timestamptz;
    end if;
    if update_item.patch ? 'ends_at' then
      v_new.ends_at := (update_item.patch ->> 'ends_at')::timestamptz;
    end if;
  exception when others then
    raise exception 'invalid_input';
  end;
  perform public.check_item_fields(
    v_new.title, v_new.starts_at, v_new.ends_at, v_new.location, v_new.private_notes
  );

  if v_new.title is distinct from v_item.title then
    v_fields := v_fields || 'title'::text;
  end if;
  if v_new.starts_at is distinct from v_item.starts_at then
    v_fields := v_fields || 'starts_at'::text;
  end if;
  if v_new.ends_at is distinct from v_item.ends_at then
    v_fields := v_fields || 'ends_at'::text;
  end if;
  if v_new.location is distinct from v_item.location then
    v_fields := v_fields || 'location'::text;
  end if;
  if v_new.private_notes is distinct from v_item.private_notes then
    v_fields := v_fields || 'private_notes'::text;
  end if;

  -- Nothing actually changed: no new version, history or notification.
  if cardinality(v_fields) = 0 then
    return v_item;
  end if;

  v_reconfirm := v_item.state = 'assigned'
    and v_item.owner_id is not null
    and v_item.owner_id is distinct from v_user
    and v_fields && array['starts_at', 'ends_at'];

  update public.items i
  set title = v_new.title,
      starts_at = v_new.starts_at,
      ends_at = v_new.ends_at,
      location = v_new.location,
      -- A new address needs geocoding again (ADR-017).
      location_lat = case when 'location' = any (v_fields) then null else i.location_lat end,
      location_lng = case when 'location' = any (v_fields) then null else i.location_lng end,
      private_notes = v_new.private_notes,
      state = case when v_reconfirm then 'awaiting_acceptance' else i.state end,
      proposed_assignee_id = case when v_reconfirm then i.owner_id else i.proposed_assignee_id end,
      owner_id = case when v_reconfirm then null else i.owner_id end,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_new;

  if v_reconfirm then
    insert into public.assignment_requests (circle_id, item_id, assigner_id, assignee_id)
    values (v_item.circle_id, v_item.id, v_user, v_item.owner_id);
  end if;

  perform public.log_item_event(v_new, v_user, 'updated', jsonb_build_object(
    'fields', to_jsonb(v_fields),
    'reconfirm_assignee_id', case when v_reconfirm then v_item.owner_id end
  ));

  if v_reconfirm then
    perform public.queue_push(v_new, v_user, 'reconfirm_requested', array[v_item.owner_id]);
  else
    perform public.queue_push(v_new, v_user, 'item_changed',
      array[v_item.owner_id, v_item.proposed_assignee_id]);
  end if;

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- assign (US 7.2, 7.5). From Needs someone, Awaiting acceptance or Assigned.
-- Assigning someone else makes the item Awaiting acceptance for them;
-- assigning yourself claims it (BR-03). Any earlier pending request is
-- superseded, and whoever had the item before (owner or proposed assignee)
-- is told it was reassigned away from them.
-- ---------------------------------------------------------------------------

create or replace function public.assign(item_id uuid, version integer, assignee_id uuid)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.items;
  v_new public.items;
  v_self boolean;
begin
  v_old := public.lock_item(assign.item_id);

  if assign.assignee_id is null
     or not public.is_circle_member(v_old.circle_id, assign.assignee_id) then
    raise exception 'invalid_input';
  end if;
  if v_old.state not in ('needs_someone', 'awaiting_acceptance', 'assigned')
     or (v_old.state = 'awaiting_acceptance' and v_old.proposed_assignee_id = assign.assignee_id)
     or (v_old.state = 'assigned' and v_old.owner_id = assign.assignee_id) then
    raise exception 'invalid_state';
  end if;
  if v_old.version is distinct from assign.version then
    raise exception 'stale_version';
  end if;

  v_self := assign.assignee_id = v_user;

  update public.assignment_requests r
  set status = 'superseded', resolved_at = now()
  where r.item_id = v_old.id and r.status = 'pending';

  if not v_self then
    insert into public.assignment_requests (circle_id, item_id, assigner_id, assignee_id)
    values (v_old.circle_id, v_old.id, v_user, assign.assignee_id);
  end if;

  update public.items i
  set state = case when v_self then 'assigned' else 'awaiting_acceptance' end,
      owner_id = case when v_self then v_user end,
      proposed_assignee_id = case when v_self then null else assign.assignee_id end,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_old.id
  returning i.* into v_new;

  perform public.log_item_event(
    v_new,
    v_user,
    case when v_self then 'claimed' else 'assigned' end,
    jsonb_build_object(
      'assignee_id', case when not v_self then assign.assignee_id end,
      'previous_owner_id', case when v_old.state = 'assigned' then v_old.owner_id end,
      'previous_assignee_id', case when v_old.state = 'awaiting_acceptance' then v_old.proposed_assignee_id end
    )
  );

  if not v_self then
    perform public.queue_push(v_new, v_user, 'assignment_requested', array[assign.assignee_id]);
  end if;
  perform public.queue_push(v_new, v_user, 'reassigned_away', array[
    case when v_old.state = 'assigned' then v_old.owner_id end,
    case when v_old.state = 'awaiting_acceptance' then v_old.proposed_assignee_id end
  ]);

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- accept_assignment and decline_assignment (US 7.3, 7.4). Only the proposed
-- assignee of the current pending request can answer it; anything else
-- (reassigned, claimed, withdrawn, someone else's request) is
-- assignment_no_longer_available. The person who asked is told the answer.
-- ---------------------------------------------------------------------------

-- Locks and returns the caller's pending request for an item that is
-- Awaiting acceptance, or raises assignment_no_longer_available.
create function public.lock_own_pending_request(item public.items)
returns public.assignment_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.assignment_requests;
begin
  select r.* into v_request
  from public.assignment_requests r
  where r.item_id = (lock_own_pending_request.item).id and r.status = 'pending'
  for update;

  if not found
     or (lock_own_pending_request.item).state <> 'awaiting_acceptance'
     or (lock_own_pending_request.item).proposed_assignee_id is distinct from auth.uid()
     or v_request.assignee_id is distinct from auth.uid() then
    raise exception 'assignment_no_longer_available';
  end if;
  return v_request;
end $$;

create or replace function public.accept_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_request public.assignment_requests;
begin
  v_item := public.lock_item(accept_assignment.item_id);
  v_request := public.lock_own_pending_request(v_item);
  if v_item.version is distinct from accept_assignment.version then
    raise exception 'stale_version';
  end if;

  update public.assignment_requests r
  set status = 'accepted', resolved_at = now()
  where r.id = v_request.id;

  update public.items i
  set state = 'assigned',
      owner_id = v_user,
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'accepted',
    jsonb_build_object('assigner_id', v_request.assigner_id));
  perform public.queue_push(v_item, v_user, 'assignment_accepted', array[v_request.assigner_id]);

  return v_item;
end $$;

create or replace function public.decline_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_request public.assignment_requests;
begin
  v_item := public.lock_item(decline_assignment.item_id);
  v_request := public.lock_own_pending_request(v_item);
  if v_item.version is distinct from decline_assignment.version then
    raise exception 'stale_version';
  end if;

  update public.assignment_requests r
  set status = 'declined', resolved_at = now()
  where r.id = v_request.id;

  update public.items i
  set state = 'needs_someone',
      owner_id = null,
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'declined',
    jsonb_build_object('assigner_id', v_request.assigner_id));
  perform public.queue_push(v_item, v_user, 'assignment_declined', array[v_request.assigner_id]);

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- withdraw_assignment (US 7.8). Any member can take back a request that
-- hasn't been answered: Awaiting acceptance → Needs someone. The proposed
-- assignee is told.
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.items;
  v_new public.items;
begin
  v_old := public.lock_item(withdraw_assignment.item_id);
  if v_old.state <> 'awaiting_acceptance' then
    raise exception 'assignment_no_longer_available';
  end if;
  if v_old.version is distinct from withdraw_assignment.version then
    raise exception 'stale_version';
  end if;

  update public.assignment_requests r
  set status = 'withdrawn', resolved_at = now()
  where r.item_id = v_old.id and r.status = 'pending';

  update public.items i
  set state = 'needs_someone',
      owner_id = null,
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_old.id
  returning i.* into v_new;

  perform public.log_item_event(v_new, v_user, 'withdrawn',
    jsonb_build_object('assignee_id', v_old.proposed_assignee_id));
  perform public.queue_push(v_new, v_user, 'assignment_withdrawn', array[v_old.proposed_assignee_id]);

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- claim (US 7.2, BR-03): "I'll do it" on a Needs someone item makes the
-- caller the confirmed owner. If someone already has it, already_claimed
-- names them, even when the caller's version is also out of date. Claiming
-- an item you already own changes nothing, so a double tap is harmless.
-- ---------------------------------------------------------------------------

create or replace function public.claim(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
begin
  v_item := public.lock_item(claim.item_id);

  if v_item.state in ('assigned', 'needs_coverage') then
    if v_item.owner_id = v_user then
      return v_item;
    end if;
    raise exception 'already_claimed' using detail = public.name_detail(v_item.owner_id);
  end if;
  if v_item.state <> 'needs_someone' then
    raise exception 'invalid_state';
  end if;
  if v_item.version is distinct from claim.version then
    raise exception 'stale_version';
  end if;

  update public.items i
  set state = 'assigned',
      owner_id = v_user,
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'claimed');

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- complete_item (US 7.9): the confirmed owner marks an Assigned item done.
-- ---------------------------------------------------------------------------

create or replace function public.complete_item(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
begin
  v_item := public.lock_item(complete_item.item_id);

  if v_item.state <> 'assigned' then
    raise exception 'invalid_state';
  end if;
  if v_item.owner_id is distinct from v_user then
    raise exception 'not_owner';
  end if;
  if v_item.version is distinct from complete_item.version then
    raise exception 'stale_version';
  end if;

  update public.items i
  set state = 'completed',
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'completed');

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- cancel_item (BR-08): any member, from any state except Completed and
-- Cancelled. Resolves a pending assignment request (withdrawn) and cancels
-- an open coverage request. The owner and proposed assignee are told.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_item(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.items;
  v_new public.items;
begin
  v_old := public.lock_item(cancel_item.item_id);

  if v_old.state in ('completed', 'cancelled') then
    raise exception 'invalid_state';
  end if;
  if v_old.version is distinct from cancel_item.version then
    raise exception 'stale_version';
  end if;

  update public.assignment_requests r
  set status = 'withdrawn', resolved_at = now()
  where r.item_id = v_old.id and r.status = 'pending';

  update public.coverage_requests c
  set status = 'cancelled', resolved_at = now()
  where c.item_id = v_old.id and c.status = 'open';

  update public.items i
  set state = 'cancelled',
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_old.id
  returning i.* into v_new;

  perform public.log_item_event(v_new, v_user, 'cancelled',
    jsonb_build_object('previous_state', v_old.state));
  perform public.queue_push(v_new, v_user, 'item_cancelled',
    array[v_old.owner_id, v_old.proposed_assignee_id]);

  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what. The RPCs above keep their grants from the initial
-- migration; the helpers are internal only.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lock_item(uuid),
  public.is_circle_member(uuid, uuid),
  public.name_detail(uuid),
  public.log_item_event(public.items, uuid, text, jsonb),
  public.queue_push(public.items, uuid, text, uuid[]),
  public.check_item_fields(text, timestamptz, timestamptz, text, text),
  public.lock_own_pending_request(public.items)
from public, anon, authenticated;
