-- Initial schema (implementation plan §4.1, ADR-012) and RPC stubs (§4.2).
--
-- RLS is enabled on every table with no policies yet, so nothing is readable
-- or writable from the app until later tasks add policies. Clients never write
-- tables directly; every state change goes through an RPC (ADR-005).
--
-- Conventions:
-- - Every circle-owned table carries circle_id (ADR-005).
-- - Authors and actors on shared content are nullable and set to null when the
--   account is deleted; the app shows null as "Former member".
-- - All times are timestamptz.

-- ---------------------------------------------------------------------------
-- People and circles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  care_recipient_name text not null,
  time_zone text not null default 'America/Vancouver', -- BR-09
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade, -- BR-12: one circle per user
  role text not null default 'member' check (role in ('member', 'admin')),
  relationship text, -- the care recipient's relationship to this member, e.g. Parent
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.invites (
  code text primary key check (code ~ '^[A-Za-z0-9]{8}$'),
  circle_id uuid not null references public.circles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

create index invites_circle_id_idx on public.invites (circle_id);

-- ---------------------------------------------------------------------------
-- Tasks and appointments
-- ---------------------------------------------------------------------------

create table public.series (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  repeat text not null check (repeat in ('daily', 'weekly', 'monthly')),
  until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index series_circle_id_idx on public.series (circle_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  kind text not null check (kind in ('task', 'appointment')),
  title text not null check (btrim(title) <> ''),
  starts_at timestamptz not null, -- due time for a task
  ends_at timestamptz check (ends_at is null or ends_at >= starts_at),
  location text,
  location_lat double precision, -- geocoded once for the map; null if not found (ADR-017)
  location_lng double precision,
  private_notes text,
  state text not null default 'needs_someone' check (
    state in (
      'needs_someone',
      'awaiting_acceptance',
      'assigned',
      'needs_coverage',
      'completed',
      'cancelled'
    )
  ),
  owner_id uuid references public.profiles (id) on delete set null, -- confirmed owner only
  proposed_assignee_id uuid references public.profiles (id) on delete set null,
  series_id uuid references public.series (id) on delete set null,
  follow_up_of uuid references public.items (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 -- optimistic check
);

create index items_circle_id_starts_at_idx on public.items (circle_id, starts_at);
create index items_owner_id_idx on public.items (owner_id);
create index items_series_id_idx on public.items (series_id);

create table public.assignment_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  assigner_id uuid references public.profiles (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  scope text not null default 'occurrence' check (scope in ('occurrence', 'future')),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'withdrawn', 'superseded')
  ),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- An item has at most one pending assignment request at a time.
create unique index assignment_requests_one_pending_idx
  on public.assignment_requests (item_id) where status = 'pending';

create table public.coverage_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  taken_by uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'taken', 'cancelled')),
  created_at timestamptz not null default now(), -- BR-01: counted per calendar month, cancelled included
  resolved_at timestamptz
);

-- An item has at most one open coverage request at a time.
create unique index coverage_requests_one_open_idx
  on public.coverage_requests (item_id) where status = 'open';
create index coverage_requests_requester_created_idx
  on public.coverage_requests (requester_id, created_at);

-- ---------------------------------------------------------------------------
-- Updates and comments
-- ---------------------------------------------------------------------------

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  item_id uuid references public.items (id) on delete set null, -- optional link
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index updates_circle_id_created_at_idx on public.updates (circle_id, created_at desc);
create index updates_item_id_idx on public.updates (item_id);

-- Table only; no UI in the prototype.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index comments_item_id_idx on public.comments (item_id);

-- ---------------------------------------------------------------------------
-- Per-member settings
-- ---------------------------------------------------------------------------

create table public.calendar_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  feed_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'), -- secret .ics URL
  feed_appointments boolean not null default true,
  feed_tasks boolean not null default false,
  google_secret_id uuid -- Vault secret holding the Google refresh token; null if not connected
);

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- One push switch per notification category (PRD US 11.4). Everything still
-- appears in the in-app list.
create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requests boolean not null default true,
  reminders boolean not null default true,
  changes boolean not null default true,
  updates boolean not null default true,
  weekly_summary boolean not null default true,
  comments boolean not null default true,
  everything_else boolean not null default false
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  item_id uuid references public.items (id) on delete cascade,
  line text not null, -- short in-app text
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- History and background jobs
-- ---------------------------------------------------------------------------

-- Append-only; written only by RPCs (ADR-013).
create table public.activity_events (
  id bigint generated always as identity primary key,
  circle_id uuid not null references public.circles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null,
  item_id uuid references public.items (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create index activity_events_circle_id_at_idx on public.activity_events (circle_id, at);
create index activity_events_item_id_idx on public.activity_events (item_id);

-- Jobs for the outbox-worker Edge Function (plan §4.4, ADR-010).
create table public.outbox (
  id bigint generated always as identity primary key,
  circle_id uuid references public.circles (id) on delete cascade,
  kind text not null check (kind in ('push', 'reminder', 'overdue', 'weekly_summary', 'geocode')),
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_pending_run_at_idx on public.outbox (run_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Row-Level Security: on everywhere, no policies yet
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.invites enable row level security;
alter table public.series enable row level security;
alter table public.items enable row level security;
alter table public.assignment_requests enable row level security;
alter table public.coverage_requests enable row level security;
alter table public.updates enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;
alter table public.outbox enable row level security;

-- ---------------------------------------------------------------------------
-- RPC stubs (plan §4.2). Each raises not_implemented until its task fills it in.
--
-- Errors: raise the error code as the message, e.g.
--   raise exception 'stale_version';
-- and put any values the message needs in DETAIL as a JSON object, e.g.
--   raise exception 'coverage_resolved' using detail = json_build_object('name', owner_name)::text;
-- web/src/lib/errors.ts turns the code into a plain-language message.
-- ---------------------------------------------------------------------------

create function public.create_circle(care_recipient_name text, relationship text, time_zone text)
returns uuid
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.create_invite()
returns text
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.join_circle(code text, relationship text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.leave_circle()
returns void
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.remove_member(member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.create_item(
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
as $$ begin raise exception 'not_implemented'; end $$;

create function public.update_item(item_id uuid, version integer, patch jsonb)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.assign(item_id uuid, version integer, assignee_id uuid)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.accept_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.decline_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.withdraw_assignment(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.claim(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.complete_item(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.cancel_item(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.coverage_remaining()
returns integer
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.request_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.cancel_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.accept_coverage(item_id uuid, version integer)
returns public.items
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.post_update(body text, item_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.mark_notifications_read(notification_id bigint default null)
returns void
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.log_share(item_id uuid, share_kind text)
returns void
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.join_demo_circle()
returns uuid
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

create function public.reset_demo_circle()
returns void
language plpgsql security definer set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

-- Read-only: the week's summary as structured lines, which the app turns into
-- sentences (plan §4.3, ADR-016). Runs as the caller so RLS applies.
create function public.weekly_summary(week_start date)
returns table (
  kind text, -- e.g. completed, overdue, open, updates
  item_id uuid,
  item_title text,
  person_id uuid, -- who did it, or who owns it; null for "Former member"
  at timestamptz,
  count integer -- for kinds that count things, e.g. updates posted
)
language plpgsql stable security invoker set search_path = ''
as $$ begin raise exception 'not_implemented'; end $$;

-- ---------------------------------------------------------------------------
-- Who can call what. Supabase grants EXECUTE to anon by default, so revoke it
-- and grant signed-in users (including anonymous demo guests, who use the
-- authenticated role) only the RPCs the app calls.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.create_circle(text, text, text),
  public.create_invite(),
  public.join_circle(text, text),
  public.leave_circle(),
  public.remove_member(uuid),
  public.create_item(text, text, timestamptz, timestamptz, text, text, uuid, text, timestamptz, uuid),
  public.update_item(uuid, integer, jsonb),
  public.assign(uuid, integer, uuid),
  public.accept_assignment(uuid, integer),
  public.decline_assignment(uuid, integer),
  public.withdraw_assignment(uuid, integer),
  public.claim(uuid, integer),
  public.complete_item(uuid, integer),
  public.cancel_item(uuid, integer),
  public.coverage_remaining(),
  public.request_coverage(uuid, integer),
  public.cancel_coverage(uuid, integer),
  public.accept_coverage(uuid, integer),
  public.post_update(text, uuid),
  public.mark_notifications_read(bigint),
  public.log_share(uuid, text),
  public.join_demo_circle(),
  public.weekly_summary(date)
to authenticated;

grant execute on function public.reset_demo_circle() to service_role;
