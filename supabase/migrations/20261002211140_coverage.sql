-- Task 3.1: coverage (PRD Epic 8, BR-01, ADR §4).
--
-- Fills in the four coverage stubs from the initial migration:
-- coverage_remaining, request_coverage, cancel_coverage and accept_coverage.
-- They follow task 2.1's conventions and reuse its helpers (lock_item,
-- is_circle_member, name_detail, log_item_event, queue_push): lock the item
-- (not_member), check the state-specific error before the version, apply the
-- transition, and write one activity_events row plus any push outbox rows in
-- the same transaction.
--
-- BR-01: each member may start at most 2 coverage requests per calendar
-- month, cancelled ones included. The month is the circle's (circles.
-- time_zone, BR-09), not the server's or the phone's.
--
-- History types: coverage_requested, coverage_cancelled, coverage_taken
-- {previous_owner_id}. Push events (plan §4.4): coverage_requested (every
-- other member) and coverage_taken (the member who asked).
--
-- The RPC signatures don't change, so `create or replace` keeps the grants
-- from the initial migration.

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------

-- How many coverage requests `person` started in the calendar month that
-- contains `as_of`, in the circle's time zone. Cancelled requests count too.
-- Takes `as_of` so tests can check either side of a month boundary.
create function public.coverage_used(person uuid, circle uuid, as_of timestamptz)
returns integer
language sql stable security definer set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('month', coverage_used.as_of at time zone c.time_zone) at time zone c.time_zone as starts,
      (date_trunc('month', coverage_used.as_of at time zone c.time_zone) + interval '1 month')
        at time zone c.time_zone as ends
    from public.circles c
    where c.id = coverage_used.circle
  )
  select count(*)::integer
  from public.coverage_requests r, bounds m
  where r.requester_id = coverage_used.person
    and r.created_at >= m.starts
    and r.created_at < m.ends
$$;

-- ---------------------------------------------------------------------------
-- coverage_remaining (US 8.1): how many requests the caller has left this
-- calendar month, never below 0.
-- ---------------------------------------------------------------------------

create or replace function public.coverage_remaining()
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_circle uuid := public.current_circle_id();
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;
  -- BR-01: 2 a month.
  return greatest(0, 2 - public.coverage_used(auth.uid(), v_circle, now()));
end $$;

-- ---------------------------------------------------------------------------
-- request_coverage (US 8.1): the owner of an Assigned item asks the family
-- to take it over. It stays theirs (owner_id) until someone taps I can do it.
-- ---------------------------------------------------------------------------

create or replace function public.request_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
begin
  v_item := public.lock_item(request_coverage.item_id);

  if v_item.state <> 'assigned' then
    raise exception 'invalid_state';
  end if;
  if v_item.owner_id is distinct from v_user then
    raise exception 'not_owner';
  end if;

  -- Two requests at once for different items would each lock only their own
  -- item, so lock the caller's profile too while counting.
  perform 1 from public.profiles p where p.id = v_user for update;
  if public.coverage_used(v_user, v_item.circle_id, now()) >= 2 then -- BR-01
    raise exception 'coverage_limit_reached';
  end if;

  if v_item.version is distinct from request_coverage.version then
    raise exception 'stale_version';
  end if;

  insert into public.coverage_requests (circle_id, item_id, requester_id)
  values (v_item.circle_id, v_item.id, v_user);

  update public.items i
  set state = 'needs_coverage',
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'coverage_requested');
  perform public.queue_push(v_item, v_user, 'coverage_requested', array(
    select cm.user_id from public.circle_members cm where cm.circle_id = v_item.circle_id
  ));

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- cancel_coverage (US 8.1): the owner takes the request back before anyone
-- has taken it. The item is Assigned to them again, and the cancelled
-- request still counts toward the limit. If someone already took it,
-- coverage_resolved names who's covering it now.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_last public.coverage_requests;
begin
  v_item := public.lock_item(cancel_coverage.item_id);

  if v_item.state <> 'needs_coverage' then
    -- Too late: the caller's request was taken in the meantime.
    select r.* into v_last
    from public.coverage_requests r
    where r.item_id = v_item.id
    order by r.created_at desc, r.id desc
    limit 1;
    if v_last.status = 'taken' and v_last.requester_id = v_user then
      raise exception 'coverage_resolved' using detail = public.name_detail(v_item.owner_id);
    end if;
    if v_item.owner_id is distinct from v_user then
      raise exception 'not_owner';
    end if;
    raise exception 'invalid_state';
  end if;
  if v_item.owner_id is distinct from v_user then
    raise exception 'not_owner';
  end if;
  if v_item.version is distinct from cancel_coverage.version then
    raise exception 'stale_version';
  end if;

  update public.coverage_requests r
  set status = 'cancelled', resolved_at = now()
  where r.item_id = v_item.id and r.status = 'open';

  update public.items i
  set state = 'assigned',
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'coverage_cancelled');

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- accept_coverage (US 8.2, BR-03): "I can do it" makes the caller the
-- confirmed owner straight away. If someone has taken it since (it's Assigned
-- again), coverage_resolved names who has it, even when the caller's version
-- is also out of date, so the second person to tap learns who's covering.
-- Any other state (e.g. cancelled meanwhile) is invalid_state. Tapping again
-- once it's yours changes nothing, so a double tap is harmless.
-- ---------------------------------------------------------------------------

create or replace function public.accept_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_previous uuid;
begin
  v_item := public.lock_item(accept_coverage.item_id);

  if v_item.state <> 'needs_coverage' then
    if v_item.state = 'assigned' and v_item.owner_id = v_user then
      return v_item;
    end if;
    if v_item.state = 'assigned' then
      raise exception 'coverage_resolved' using detail = public.name_detail(v_item.owner_id);
    end if;
    -- Cancelled, completed or back to needing someone: nobody is covering it.
    raise exception 'invalid_state';
  end if;
  if v_item.owner_id = v_user then
    -- Your own request: cancel it instead.
    raise exception 'invalid_state';
  end if;
  if v_item.version is distinct from accept_coverage.version then
    raise exception 'stale_version';
  end if;

  v_previous := v_item.owner_id;

  update public.coverage_requests r
  set status = 'taken', taken_by = v_user, resolved_at = now()
  where r.item_id = v_item.id and r.status = 'open';

  update public.items i
  set state = 'assigned',
      owner_id = v_user,
      proposed_assignee_id = null,
      version = i.version + 1,
      updated_at = now()
  where i.id = v_item.id
  returning i.* into v_item;

  perform public.log_item_event(v_item, v_user, 'coverage_taken',
    jsonb_build_object('previous_owner_id', v_previous));
  perform public.queue_push(v_item, v_user, 'coverage_taken', array[v_previous]);

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what. The RPCs above keep their grants from the initial
-- migration; the helpers are internal only.
-- ---------------------------------------------------------------------------

revoke execute on function public.coverage_used(uuid, uuid, timestamptz)
from public, anon, authenticated;
