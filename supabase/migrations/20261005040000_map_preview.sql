-- Task 4.5h: map preview (plan §4.4, ADR-017, PRD US 4.3).
--
-- When an appointment's location is set or changed (create_item, update_item,
-- recurrence occurrences, or any other insert), a trigger on items clears its
-- coordinates and either:
--   - copies them from another appointment in the same circle with exactly
--     the same location text that has already been found on the map, or
--   - queues a `geocode` outbox job {item_id}, unless one is already waiting
--     for the same location text in the circle. So a daily series at the same
--     clinic is geocoded once, not once per occurrence. If the item a job is
--     for moves elsewhere first, the job passes to another item still at the
--     old place (or is dropped if there's none).
-- The outbox-worker reads the item's location text, asks Geoapify where it is
-- (sending only that text), and calls store_geocode() with the result, which
-- fills in every appointment in the circle still waiting at that text. If
-- nothing is found the coordinates stay null and the app shows the location
-- as text. Tasks are never geocoded.
--
-- The payload holds the item ID only, never the location text (ADR-010).
-- claim_outbox_jobs, outbox_catch_up and the outbox insert trigger take
-- `geocode` jobs too, so the map appears within seconds.

-- ---------------------------------------------------------------------------
-- Queuing, from a trigger on items
-- ---------------------------------------------------------------------------

-- Finding another appointment at the same place, and a geocode job already
-- waiting in the circle.
create index items_circle_location_idx on public.items (circle_id, location)
  where location is not null;

create index outbox_geocode_pending_idx on public.outbox (circle_id, (payload ->> 'item_id'))
  where kind = 'geocode' and status = 'pending';

-- Before insert or a change of location, so the coordinates written always
-- match the location text.
create function public.items_geocode_location()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_heir uuid;
begin
  if tg_op = 'UPDATE' then
    if new.location is not distinct from old.location then
      return new;
    end if;

    -- This item's waiting job may stand for others still at the old place
    -- (see below): hand it to one of them, or drop it if there are none.
    if old.location is not null then
      select i.id into v_heir
      from public.items i
      where i.circle_id = old.circle_id
        and i.kind = 'appointment'
        and i.location = old.location
        and i.location_lat is null
        and i.id <> old.id
      limit 1;
      update public.outbox o
      set payload = case when v_heir is null then o.payload else jsonb_build_object('item_id', v_heir) end,
          status = case when v_heir is null then 'done' else o.status end,
          last_error = case when v_heir is null then 'superseded' else o.last_error end
      where o.kind = 'geocode'
        and o.status = 'pending'
        and o.circle_id = old.circle_id
        and o.payload ->> 'item_id' = old.id::text;
    end if;
  end if;

  new.location_lat := null;
  new.location_lng := null;
  if new.kind <> 'appointment' or new.location is null then
    return new;
  end if;

  -- Already found for another appointment in the circle: reuse it.
  select i.location_lat, i.location_lng into new.location_lat, new.location_lng
  from public.items i
  where i.circle_id = new.circle_id
    and i.location = new.location
    and i.id <> new.id
    and i.location_lat is not null
    and i.location_lng is not null
  limit 1;
  if new.location_lat is not null then
    return new;
  end if;

  -- One job per place: rows inserted earlier in the same statement (a new
  -- series' occurrences) and their jobs are visible here.
  if not exists (
    select 1
    from public.outbox o
    join public.items i on i.id = (o.payload ->> 'item_id')::uuid
    where o.kind = 'geocode'
      and o.status = 'pending'
      and o.circle_id = new.circle_id
      and i.location = new.location
  ) then
    insert into public.outbox (circle_id, kind, payload)
    values (new.circle_id, 'geocode', jsonb_build_object('item_id', new.id));
  end if;

  return new;
end $$;

create trigger items_geocode_location
  before insert or update of location on public.items
  for each row
  execute function public.items_geocode_location();

-- ---------------------------------------------------------------------------
-- Storing the result (the worker, as the service role)
-- ---------------------------------------------------------------------------

-- Sets the coordinates of every appointment in item_id's circle whose
-- location is exactly `location` and that has none yet. `location` is the
-- text the worker sent to Geoapify, so if an item's location changed since,
-- it isn't given the old place's coordinates. Returns how many items it
-- updated. Errors: invalid_input (coordinates out of range or missing).
create function public.store_geocode(
  item_id uuid,
  location text,
  lat double precision,
  lng double precision
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if store_geocode.item_id is null or store_geocode.location is null
     or store_geocode.lat is null or store_geocode.lng is null
     or store_geocode.lat not between -90 and 90
     or store_geocode.lng not between -180 and 180 then
    raise exception 'invalid_input';
  end if;

  update public.items i
  set location_lat = store_geocode.lat,
      location_lng = store_geocode.lng
  where i.circle_id = (select x.circle_id from public.items x where x.id = store_geocode.item_id)
    and i.kind = 'appointment'
    and i.location = store_geocode.location
    and i.location_lat is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Sending: the worker claims geocode jobs too. Same as
-- 20261005030000_weekly_summary.sql (and the push trigger from
-- 20261003000000_outbox_push_worker.sql), with the kinds widened.
-- ---------------------------------------------------------------------------

create or replace function public.claim_outbox_jobs(max_jobs integer default 10)
returns setof public.outbox
language plpgsql security definer set search_path = ''
as $$
begin
  update public.outbox o
  set status = 'failed',
      last_error = coalesce(o.last_error, 'worker_did_not_finish')
  where o.id in (
    select x.id from public.outbox x
    where x.kind in ('push', 'reminder', 'overdue', 'weekly_summary', 'geocode')
      and x.status = 'sending' and x.run_at <= now() and x.attempts >= 5
    for update skip locked
  );

  return query
  with due as (
    select x.id from public.outbox x
    where x.kind in ('push', 'reminder', 'overdue', 'weekly_summary', 'geocode')
      and x.status in ('pending', 'sending')
      and x.run_at <= now()
      and x.attempts < 5
    order by x.run_at, x.id
    limit greatest(coalesce(claim_outbox_jobs.max_jobs, 0), 0)
    for update skip locked
  )
  update public.outbox o
  set status = 'sending',
      attempts = o.attempts + 1,
      run_at = now() + interval '2 minutes'
  from due
  where o.id = due.id
  returning o.*;
end $$;

create or replace function public.outbox_catch_up()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.outbox o
    where o.kind in ('push', 'reminder', 'overdue', 'weekly_summary', 'geocode')
      and o.status in ('pending', 'sending') and o.run_at <= now()
  ) then
    perform public.invoke_outbox_worker();
  end if;
end $$;

-- A geocode job calls the worker straight away, like a push, so the map shows
-- within seconds of saving.
create or replace function public.outbox_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from new_rows r where r.kind in ('push', 'geocode')) then
    perform public.invoke_outbox_worker();
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what: only the worker stores coordinates; the trigger function
-- is internal. claim_outbox_jobs, outbox_catch_up and outbox_after_insert keep
-- their grants (create or replace).
-- ---------------------------------------------------------------------------

revoke execute on function
  public.items_geocode_location(),
  public.store_geocode(uuid, text, double precision, double precision)
from public, anon, authenticated, service_role;

grant execute on function public.store_geocode(uuid, text, double precision, double precision)
to service_role;
