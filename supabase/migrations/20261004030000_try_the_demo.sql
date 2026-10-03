-- Task 4.2: Try the demo (ADR-004, plan §8.5).
--
-- Someone with no account taps Try the demo: the app signs them in with
-- Supabase anonymous sign-in, then calls join_demo_circle(), which adds them
-- to the shared sample circle from task 4.7 with a few requests of their own.
--
-- - join_demo_circle(): anonymous users only. Joins the sample circle
--   (idempotent), names the guest "Guest 1234" if they have no name, and on
--   first joining creates three items awaiting the guest's acceptance.
-- - reset_demo_circle(): service role only. Rebuilds the sample circle with
--   build_sample_circle() and removes every guest from it.
-- - demo_nightly_cleanup(): run by pg_cron every night. Resets the sample
--   circle and deletes anonymous users more than a day old.
-- - Loads the sample circle once, so the hosted project has it after deploy.
--
-- build_sample_circle() deletes and recreates the circle row. A join that
-- waited on that row could then fail its foreign-key check, so
-- join_demo_circle and reset_demo_circle first take the same
-- transaction-level advisory lock, and each sees the other's committed work.

-- The advisory lock key both functions share (any fixed number will do).
create function public.lock_demo_circle()
returns void
language sql security definer set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(5743110100)
$$;

-- ---------------------------------------------------------------------------
-- join_demo_circle
-- ---------------------------------------------------------------------------

create or replace function public.join_demo_circle()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz constant text := 'America/Vancouver';
  v_today constant date := (now() at time zone 'America/Vancouver')::date;
  v_circle constant uuid := '5a3b1e00-0000-4000-8000-000000000100';
  v_maya constant uuid := '5a3b1e00-0000-4000-8000-000000000001';
  v_daniel constant uuid := '5a3b1e00-0000-4000-8000-000000000002';
  v_priya constant uuid := '5a3b1e00-0000-4000-8000-000000000003';
  v_user uuid := auth.uid();
  v_current uuid;
  v_item public.items;
  r record;
begin
  -- Only demo guests: a real account would lose its own circle (BR-12).
  if v_user is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'invalid_input';
  end if;

  perform public.lock_demo_circle();

  select cm.circle_id into v_current from public.circle_members cm where cm.user_id = v_user;
  if v_current = v_circle then
    return v_circle; -- already in: nothing more to do
  elsif v_current is not null then
    raise exception 'already_in_other_circle'; -- BR-12
  end if;

  -- Not loaded yet (e.g. a fresh database): build it now.
  if not exists (select 1 from public.circles c where c.id = v_circle) then
    perform public.build_sample_circle();
  end if;

  -- A short random suffix tells guests apart in the shared circle.
  perform public.save_profile(v_user, null);
  update public.profiles p
  set display_name = 'Guest ' || lpad((floor(random() * 10000))::integer::text, 4, '0')
  where p.id = v_user and nullif(btrim(p.display_name), '') is null;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle, v_user, 'member');

  insert into public.activity_events (circle_id, actor_id, type)
  values (v_circle, v_user, 'member_joined');

  -- Three requests for the guest, from each sibling, due in the next few
  -- days, so Needs your answer has something to do. Written as create_item
  -- writes them: a pending request, a created event and a push job.
  for r in
    select * from (values
      (v_maya, 'task', 'Pick up Mom''s library books',
       ((v_today + 1) + time '16:00') at time zone v_tz, null::timestamptz,
       'Westside Library', 'Three books on hold under her name. They close at 6.'),
      (v_daniel, 'appointment', 'Drive Mom to the dentist',
       ((v_today + 2) + time '10:00') at time zone v_tz, ((v_today + 2) + time '11:00') at time zone v_tz,
       'Kingsway Dental', 'Just a cleaning. She likes to arrive 10 minutes early.'),
      (v_priya, 'task', 'Call Mom after dinner',
       ((v_today + 3) + time '19:30') at time zone v_tz, null::timestamptz,
       null, 'She wanted to hear how the week went.')
    ) as t (asker, kind, title, starts_at, ends_at, location, private_notes)
  loop
    insert into public.items (
      circle_id, kind, title, starts_at, ends_at, location, private_notes,
      state, proposed_assignee_id, created_by
    )
    values (
      v_circle, r.kind, r.title, r.starts_at, r.ends_at, r.location, r.private_notes,
      'awaiting_acceptance', v_user, r.asker
    )
    returning * into v_item;

    insert into public.assignment_requests (circle_id, item_id, assigner_id, assignee_id)
    values (v_circle, v_item.id, r.asker, v_user);

    perform public.log_item_event(v_item, r.asker, 'created', jsonb_build_object(
      'kind', v_item.kind, 'state', v_item.state, 'assignee_id', v_user
    ));
    perform public.queue_push(v_item, r.asker, 'assignment_requested', array[v_user]);
  end loop;

  return v_circle;
end $$;

-- ---------------------------------------------------------------------------
-- reset_demo_circle
-- ---------------------------------------------------------------------------

create or replace function public.reset_demo_circle()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_circle uuid;
begin
  perform public.lock_demo_circle();

  v_circle := public.build_sample_circle();

  -- Everyone but the three sample people. Their items and changes went with
  -- the rebuild; the next Try the demo joins them again.
  delete from public.circle_members cm
  where cm.circle_id = v_circle
    and cm.user_id not in (
      '5a3b1e00-0000-4000-8000-000000000001',
      '5a3b1e00-0000-4000-8000-000000000002',
      '5a3b1e00-0000-4000-8000-000000000003'
    );
end $$;

-- ---------------------------------------------------------------------------
-- Nightly clean-up
-- ---------------------------------------------------------------------------

-- Resets the sample circle, then deletes demo guests (anonymous users) more
-- than a day old. Deleting the auth.users row cascades to their profile,
-- membership, push subscriptions, settings and notifications; items and
-- history keep the rows with the person set to null. The three sample people
-- aren't anonymous, so they're never deleted.
create function public.demo_nightly_cleanup()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.reset_demo_circle();

  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '1 day';
end $$;

revoke execute on function
  public.lock_demo_circle(),
  public.demo_nightly_cleanup()
from public, anon, authenticated;

-- reset_demo_circle keeps its grant from the initial migration (service role
-- only); demo_nightly_cleanup can be run by hand the same way.
grant execute on function public.demo_nightly_cleanup() to service_role;

-- Every night at 10:00 UTC, the middle of the night in Vancouver. Re-running
-- cron.schedule with the same name replaces the job.
select cron.schedule('demo-nightly-cleanup', '0 10 * * *', 'select public.demo_nightly_cleanup()');

-- ---------------------------------------------------------------------------
-- Load the sample circle once. build_sample_circle() only ever deletes the
-- circle with the sample circle's fixed ID, so no other circle is touched.
-- ---------------------------------------------------------------------------

select public.build_sample_circle();
