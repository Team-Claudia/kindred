-- Task 4.5c: recurrence (plan §4.2, ADR-007, PRD US 7.6, BR-10).
--
-- create_item takes repeat ('daily', 'weekly', 'monthly') and an optional
-- until. It stores the rule and what to copy in a series row, then inserts a
-- real items row for each occurrence up to 90 days ahead (or until). A nightly
-- pg_cron job tops every series up to 90 days ahead. Each occurrence is an
-- ordinary, independent item: editing, claiming, completing or cancelling one
-- never touches the others ("this occurrence only", Tier 2).
--
-- Occurrence n starts at the first one's local time in the circle's time zone
-- plus n days, weeks or months, so it keeps its local time across a
-- daylight-saving change. Adding months to a local date clamps to the end of a
-- shorter month (31 Jan + 1 month = 28 Feb), and each occurrence is counted
-- from the first, so a series on the 31st lands on the last day of every
-- month and goes back to the 31st when the month has one.
--
-- Assigning someone at creation asks them about the first occurrence only
-- (one request, one push); the rest Need someone. Assigning yourself claims
-- the first occurrence only, the same way.
--
-- Reminders and overdue alerts need nothing here: the items_schedule_jobs
-- trigger (task 4.5b) queues them for every inserted occurrence.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- What each occurrence copies (as first created; editing one occurrence
-- doesn't change the series), and the index of the next one to insert.
-- create_item has refused repeats until now, so the table is empty.
alter table public.series
  add column kind text not null check (kind in ('task', 'appointment')),
  add column title text not null check (btrim(title) <> ''),
  add column starts_at timestamptz not null, -- the first occurrence
  add column ends_at timestamptz check (ends_at is null or ends_at >= starts_at),
  add column location text,
  add column private_notes text,
  add column next_index integer not null default 0 check (next_index >= 0),
  add constraint series_until_after_start check (until is null or until >= starts_at);

-- 0 for the first occurrence, then 1, 2, … Null for a one-off item.
alter table public.items
  add column occurrence_index integer check (occurrence_index >= 0);

drop index public.items_series_id_idx;
create unique index items_series_occurrence_idx on public.items (series_id, occurrence_index);

-- ---------------------------------------------------------------------------
-- Occurrences
-- ---------------------------------------------------------------------------

-- How far ahead occurrences are inserted. A function so the pgTAP tests can
-- fix "now" for dates on either side of a daylight-saving change.
create function public.series_horizon()
returns timestamptz
language sql stable set search_path = ''
as $$
  select now() + interval '90 days'
$$;

-- When occurrence n of a series starting at `first` starts: the same local
-- time in `time_zone`, n days, weeks or months later.
create function public.series_occurrence_at(first timestamptz, repeat text, n integer, time_zone text)
returns timestamptz
language sql stable set search_path = ''
as $$
  select ((series_occurrence_at.first at time zone series_occurrence_at.time_zone)
          + case series_occurrence_at.repeat
              when 'daily' then make_interval(days => series_occurrence_at.n)
              when 'weekly' then make_interval(weeks => series_occurrence_at.n)
              else make_interval(months => series_occurrence_at.n)
            end) at time zone series_occurrence_at.time_zone
$$;

-- Inserts a series' missing occurrences up to series_horizon() (or its
-- until), each Needing someone, with a `created` history row by `actor` (null
-- for the nightly job). Locks the series, so two runs never insert the same
-- occurrence. Inserts at most 400 per call; the next night carries on.
-- Returns how many it inserted.
create function public.extend_series(series_id uuid, actor uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_series public.series;
  v_time_zone text;
  v_through timestamptz := public.series_horizon();
  v_start timestamptz;
  v_item public.items;
  v_added integer := 0;
begin
  select s.* into v_series
  from public.series s
  where s.id = extend_series.series_id
  for update;
  if not found then
    return 0;
  end if;

  select c.time_zone into v_time_zone from public.circles c where c.id = v_series.circle_id;
  if v_series.until is not null then
    v_through := least(v_through, v_series.until);
  end if;

  loop
    exit when v_added >= 400;
    v_start := public.series_occurrence_at(v_series.starts_at, v_series.repeat, v_series.next_index, v_time_zone);
    exit when v_start > v_through;

    insert into public.items (
      circle_id, kind, title, starts_at, ends_at, location, private_notes,
      series_id, occurrence_index, created_by
    )
    values (
      v_series.circle_id, v_series.kind, v_series.title, v_start,
      v_start + (v_series.ends_at - v_series.starts_at),
      v_series.location, v_series.private_notes,
      v_series.id, v_series.next_index, v_series.created_by
    )
    returning * into v_item;

    perform public.log_item_event(v_item, extend_series.actor, 'created', jsonb_build_object(
      'kind', v_item.kind,
      'state', v_item.state,
      'series_id', v_series.id
    ));

    v_series.next_index := v_series.next_index + 1;
    v_added := v_added + 1;
  end loop;

  update public.series s
  set next_index = v_series.next_index
  where s.id = v_series.id;

  return v_added;
end $$;

-- The nightly job: tops up every series that hasn't reached its until.
create function public.extend_all_series()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_series uuid;
  v_added integer := 0;
begin
  for v_series in
    select s.id from public.series s
    where s.until is null
       or public.series_occurrence_at(s.starts_at, s.repeat, s.next_index,
            (select c.time_zone from public.circles c where c.id = s.circle_id)) <= s.until
    order by s.created_at, s.id
  loop
    v_added := v_added + public.extend_series(v_series, null);
  end loop;
  return v_added;
end $$;

-- ---------------------------------------------------------------------------
-- create_item: as in 20261001160459_item_state_machine.sql, with repeat and
-- until in place of not_implemented. Returns the first occurrence's ID.
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
  v_series uuid;
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

  -- Repeats: a known rule; an until only with a rule, and not before the
  -- start; and a follow-up is a single item.
  if create_item.repeat is not null
     and (create_item.repeat not in ('daily', 'weekly', 'monthly')
          or create_item.follow_up_of is not null) then
    raise exception 'invalid_input';
  end if;
  if create_item.until is not null
     and (create_item.repeat is null or create_item.until < create_item.starts_at) then
    raise exception 'invalid_input';
  end if;

  if create_item.repeat is not null then
    insert into public.series (
      circle_id, repeat, until, created_by,
      kind, title, starts_at, ends_at, location, private_notes, next_index
    )
    values (
      v_circle, create_item.repeat, create_item.until, v_user,
      create_item.kind, v_title, create_item.starts_at, create_item.ends_at,
      v_location, v_notes, 1
    )
    returning id into v_series;
  end if;

  insert into public.items (
    circle_id, kind, title, starts_at, ends_at, location, private_notes,
    state, owner_id, proposed_assignee_id, follow_up_of, series_id, occurrence_index, created_by
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
    v_series,
    case when v_series is not null then 0 end,
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
    'follow_up_of', v_item.follow_up_of,
    'series_id', v_series
  ));

  if v_item.state = 'awaiting_acceptance' then
    perform public.queue_push(v_item, v_user, 'assignment_requested', array[create_item.assignee_id]);
  end if;

  -- The rest of the series, up to 90 days ahead or until.
  if v_series is not null then
    perform public.extend_series(v_series, v_user);
  end if;

  return v_item.id;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what: create_item keeps its grants (create or replace). The
-- nightly job is the service role's; the helpers are internal.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.series_horizon(),
  public.series_occurrence_at(timestamptz, text, integer, text),
  public.extend_series(uuid, uuid),
  public.extend_all_series()
from public, anon, authenticated, service_role;

grant execute on function public.extend_all_series() to service_role;

-- Every night at 09:30 UTC, the middle of the night across Canada, half an
-- hour before demo-nightly-cleanup. Re-running cron.schedule with the same
-- name replaces the job.
select cron.schedule('recurrence-nightly-extension', '30 9 * * *', 'select public.extend_all_series()');
