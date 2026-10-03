-- Task 4.7: the sample circle behind Try the demo (plan §8.5).
--
-- build_sample_circle() builds the circle written up in docs/sample-data.md:
-- Mom (Margaret) on America/Vancouver time, cared for by three fictional
-- siblings, Maya, Daniel and Priya Hart, with 16 items across every state and
-- two weeks of history. Dates are relative to now() in the circle's time zone,
-- so the circle always looks current.
--
-- It's re-runnable: each call deletes the sample circle (and only that one,
-- by its fixed ID) and builds it again. Anyone else in it, such as demo
-- guests, stays a member of the rebuilt circle, but everything they did there
-- is cleared. Task 4.2's reset_demo_circle() calls it; this migration only
-- defines it and loads nothing.
--
-- Fixed IDs (plan §4.2, §8.5), so task 4.2 can find them:
--
--   Circle  5a3b1e00-0000-4000-8000-000000000100  Mom
--   Maya    5a3b1e00-0000-4000-8000-000000000001  admin
--   Daniel  5a3b1e00-0000-4000-8000-000000000002  member
--   Priya   5a3b1e00-0000-4000-8000-000000000003  member
--   Items   5a3b1e00-0000-4000-8000-0000000002xx  (listed below)
--
-- The sample people aren't real accounts. Items need profiles rows for their
-- owners and authors, and profiles reference auth.users, so the function
-- inserts auth.users rows that can't be used to sign in: no password (an
-- empty encrypted_password never matches), no auth.identities row, an
-- unconfirmed, non-routable @example.invalid address, and no sign-in
-- provider. handle_new_user (task 1.1) then creates each profile. These rows
-- are kept across rebuilds; only their display names are reset.
--
-- Like supabase/seed.sql, this inserts rows directly, which only a
-- service-role builder may do; the app always changes data through RPCs. Rows
-- follow PRD §17: owner_id is the confirmed owner (Assigned, Needs coverage,
-- Completed), proposed_assignee_id is set only while Awaiting acceptance with
-- one pending assignment request, and Needs coverage has one open coverage
-- request. History rows use the types and data the RPCs write (plan §4.2).

create function public.build_sample_circle()
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz constant text := 'America/Vancouver';
  -- Today in the circle's time zone; local times below are built from it.
  v_today constant date := (now() at time zone 'America/Vancouver')::date;
  -- The start of this calendar month in the circle's time zone (BR-01, BR-09).
  v_month_start constant timestamptz :=
    date_trunc('month', now() at time zone 'America/Vancouver') at time zone 'America/Vancouver';
  -- The next Friday after today, for "Pick up prescription by Friday".
  v_friday constant date :=
    (v_today + 1) + ((12 - extract(isodow from v_today + 1)::integer) % 7);

  v_circle constant uuid := '5a3b1e00-0000-4000-8000-000000000100';
  v_maya constant uuid := '5a3b1e00-0000-4000-8000-000000000001';
  v_daniel constant uuid := '5a3b1e00-0000-4000-8000-000000000002';
  v_priya constant uuid := '5a3b1e00-0000-4000-8000-000000000003';

  i_cardiology constant uuid := '5a3b1e00-0000-4000-8000-000000000201'; -- Completed (Daniel)
  i_prescription constant uuid := '5a3b1e00-0000-4000-8000-000000000202'; -- Awaiting acceptance (Maya), follow-up
  i_physio_1 constant uuid := '5a3b1e00-0000-4000-8000-000000000203'; -- Completed (Daniel), last week
  i_physio_2 constant uuid := '5a3b1e00-0000-4000-8000-000000000204'; -- Assigned (Daniel took Maya's coverage request)
  i_physio_3 constant uuid := '5a3b1e00-0000-4000-8000-000000000205'; -- Assigned (Maya)
  i_physio_4 constant uuid := '5a3b1e00-0000-4000-8000-000000000206'; -- Needs someone
  i_meds_1 constant uuid := '5a3b1e00-0000-4000-8000-000000000207'; -- Completed (Priya), 2 days ago
  i_meds_2 constant uuid := '5a3b1e00-0000-4000-8000-000000000208'; -- Assigned (Priya), yesterday: Overdue
  i_meds_3 constant uuid := '5a3b1e00-0000-4000-8000-000000000209'; -- Needs someone, today
  i_meds_4 constant uuid := '5a3b1e00-0000-4000-8000-000000000210'; -- Needs someone, tomorrow
  i_meds_5 constant uuid := '5a3b1e00-0000-4000-8000-000000000211'; -- Needs someone, in 2 days
  i_hearing constant uuid := '5a3b1e00-0000-4000-8000-000000000212'; -- Needs coverage (Priya)
  i_eye_exam constant uuid := '5a3b1e00-0000-4000-8000-000000000213'; -- Cancelled
  i_grab_bar constant uuid := '5a3b1e00-0000-4000-8000-000000000214'; -- Needs someone
  i_home_care constant uuid := '5a3b1e00-0000-4000-8000-000000000215'; -- Needs someone
  i_groceries constant uuid := '5a3b1e00-0000-4000-8000-000000000216'; -- Completed (Daniel), 12 days ago

  -- Maya's one coverage request this month (so she has 1 of 2 left). It's
  -- yesterday, or the start of the month if that's later, so it always falls
  -- in the current month. Daniel took it halfway between then and now.
  v_cover_asked constant timestamptz := greatest(v_month_start, now() - interval '1 day');
  v_cover_taken constant timestamptz := v_cover_asked + (now() - v_cover_asked) / 2;
  -- Priya asked for cover on the hearing aid fitting a few hours ago.
  v_hearing_asked constant timestamptz := now() - interval '5 hours';

  v_guests public.circle_members[];
begin
  -- -------------------------------------------------------------------------
  -- Start over: keep anyone else's membership (e.g. demo guests), then delete
  -- the circle, which cascades to its members, items, requests, updates,
  -- history, invites, notifications and outbox jobs.
  -- -------------------------------------------------------------------------
  v_guests := array(
    select cm from public.circle_members cm
    where cm.circle_id = v_circle and cm.user_id not in (v_maya, v_daniel, v_priya)
  );
  delete from public.circles c where c.id = v_circle;

  -- -------------------------------------------------------------------------
  -- The sample people: accounts nobody can sign in to (see the header).
  -- -------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
    '{"sample": true}'::jsonb,
    jsonb_build_object('full_name', u.full_name),
    now(), now(),
    '', '', '', ''
  from (values
    (v_maya, 'maya.hart@example.invalid', 'Maya Hart'),
    (v_daniel, 'daniel.hart@example.invalid', 'Daniel Hart'),
    (v_priya, 'priya.hart@example.invalid', 'Priya Hart')
  ) as u (id, email, full_name)
  on conflict (id) do nothing;

  -- handle_new_user created the profiles on the first run. The upsert resets
  -- the names on later runs, and recreates a profile if one has gone missing.
  insert into public.profiles (id, display_name) values
    (v_maya, 'Maya Hart'),
    (v_daniel, 'Daniel Hart'),
    (v_priya, 'Priya Hart')
  on conflict (id) do update set display_name = excluded.display_name;

  -- -------------------------------------------------------------------------
  -- The circle. Mom is each sibling's Parent.
  -- -------------------------------------------------------------------------
  insert into public.circles (id, care_recipient_name, time_zone, created_at)
  values (v_circle, 'Mom', v_tz, ((v_today - 14) + time '09:00') at time zone v_tz);

  insert into public.circle_members (circle_id, user_id, role, relationship, joined_at) values
    (v_circle, v_maya, 'admin', 'Parent', ((v_today - 14) + time '09:00') at time zone v_tz),
    (v_circle, v_daniel, 'member', 'Parent', ((v_today - 14) + time '12:00') at time zone v_tz),
    (v_circle, v_priya, 'member', 'Parent', ((v_today - 13) + time '08:00') at time zone v_tz);

  insert into public.circle_members (circle_id, user_id, role, relationship, joined_at)
  select v_circle, g.user_id, g.role, g.relationship, g.joined_at
  from unnest(v_guests) as g;

  insert into public.activity_events (circle_id, actor_id, type, at) values
    (v_circle, v_maya, 'circle_created', ((v_today - 14) + time '09:00') at time zone v_tz),
    (v_circle, v_daniel, 'member_joined', ((v_today - 14) + time '12:00') at time zone v_tz),
    (v_circle, v_priya, 'member_joined', ((v_today - 13) + time '08:00') at time zone v_tz);

  -- -------------------------------------------------------------------------
  -- Items
  -- -------------------------------------------------------------------------
  insert into public.items (
    id, circle_id, kind, title, starts_at, ends_at, location, private_notes,
    state, owner_id, proposed_assignee_id, follow_up_of, created_by, created_at, updated_at, version
  ) values
    -- Maya asked Daniel; he accepted, took Mom and marked it done.
    (i_cardiology, v_circle, 'appointment', 'Cardiology — Dr. Patel',
     ((v_today - 2) + time '10:30') at time zone v_tz, ((v_today - 2) + time '11:30') at time zone v_tz,
     'Harbourview Heart Clinic, 3rd floor', 'Bring the list of current medications and the blood pressure log.',
     'completed', v_daniel, null, null, v_maya,
     ((v_today - 9) + time '19:00') at time zone v_tz, ((v_today - 2) + time '12:00') at time zone v_tz, 3),
    -- Daniel's follow-up from the cardiology visit, asking Maya.
    (i_prescription, v_circle, 'task', 'Pick up prescription by Friday',
     (v_friday + time '17:00') at time zone v_tz, null,
     'Cedar Street Pharmacy', 'Dr. Patel changed the dose. The new prescription was sent over this morning.',
     'awaiting_acceptance', null, v_maya, i_cardiology, v_daniel,
     ((v_today - 2) + time '12:20') at time zone v_tz, ((v_today - 2) + time '12:20') at time zone v_tz, 1),

    -- Weekly "Drive Mom to physio". Recurrence is Tier 2, so each week is its
    -- own item. Maya added the next four at once.
    (i_physio_1, v_circle, 'appointment', 'Drive Mom to physio',
     ((v_today - 6) + time '14:00') at time zone v_tz, ((v_today - 6) + time '15:00') at time zone v_tz,
     'Westside Physiotherapy', null,
     'completed', v_daniel, null, null, v_maya,
     ((v_today - 13) + time '09:00') at time zone v_tz, ((v_today - 6) + time '15:30') at time zone v_tz, 3),
    (i_physio_2, v_circle, 'appointment', 'Drive Mom to physio',
     ((v_today + 1) + time '14:00') at time zone v_tz, ((v_today + 1) + time '15:00') at time zone v_tz,
     'Westside Physiotherapy', null,
     'assigned', v_daniel, null, null, v_maya,
     ((v_today - 13) + time '09:00') at time zone v_tz, v_cover_taken, 4),
    (i_physio_3, v_circle, 'appointment', 'Drive Mom to physio',
     ((v_today + 8) + time '14:00') at time zone v_tz, ((v_today + 8) + time '15:00') at time zone v_tz,
     'Westside Physiotherapy', null,
     'assigned', v_maya, null, null, v_maya,
     ((v_today - 13) + time '09:00') at time zone v_tz, ((v_today - 13) + time '09:05') at time zone v_tz, 2),
    (i_physio_4, v_circle, 'appointment', 'Drive Mom to physio',
     ((v_today + 15) + time '14:00') at time zone v_tz, ((v_today + 15) + time '15:00') at time zone v_tz,
     'Westside Physiotherapy', null,
     'needs_someone', null, null, null, v_maya,
     ((v_today - 13) + time '09:00') at time zone v_tz, ((v_today - 13) + time '09:00') at time zone v_tz, 1),

    -- Daily "Evening medication check", again one item per day. Priya added
    -- five days' worth and took the first two.
    (i_meds_1, v_circle, 'task', 'Evening medication check',
     ((v_today - 2) + time '19:00') at time zone v_tz, null, null,
     'Pill organizer is on the kitchen counter. Check the evening slot is empty.',
     'completed', v_priya, null, null, v_priya,
     ((v_today - 3) + time '09:00') at time zone v_tz, ((v_today - 2) + time '19:15') at time zone v_tz, 2),
    (i_meds_2, v_circle, 'task', 'Evening medication check',
     ((v_today - 1) + time '19:00') at time zone v_tz, null, null,
     'Pill organizer is on the kitchen counter. Check the evening slot is empty.',
     'assigned', v_priya, null, null, v_priya,
     ((v_today - 3) + time '09:00') at time zone v_tz, ((v_today - 3) + time '09:00') at time zone v_tz, 1),
    (i_meds_3, v_circle, 'task', 'Evening medication check',
     (v_today + time '19:00') at time zone v_tz, null, null,
     'Pill organizer is on the kitchen counter. Check the evening slot is empty.',
     'needs_someone', null, null, null, v_priya,
     ((v_today - 3) + time '09:00') at time zone v_tz, ((v_today - 3) + time '09:00') at time zone v_tz, 1),
    (i_meds_4, v_circle, 'task', 'Evening medication check',
     ((v_today + 1) + time '19:00') at time zone v_tz, null, null,
     'Pill organizer is on the kitchen counter. Check the evening slot is empty.',
     'needs_someone', null, null, null, v_priya,
     ((v_today - 3) + time '09:00') at time zone v_tz, ((v_today - 3) + time '09:00') at time zone v_tz, 1),
    (i_meds_5, v_circle, 'task', 'Evening medication check',
     ((v_today + 2) + time '19:00') at time zone v_tz, null, null,
     'Pill organizer is on the kitchen counter. Check the evening slot is empty.',
     'needs_someone', null, null, null, v_priya,
     ((v_today - 3) + time '09:00') at time zone v_tz, ((v_today - 3) + time '09:00') at time zone v_tz, 1),

    -- Priya took it for herself, then a work trip came up.
    (i_hearing, v_circle, 'appointment', 'Hearing aid fitting',
     ((v_today + 4) + time '11:00') at time zone v_tz, ((v_today + 4) + time '11:45') at time zone v_tz,
     'Lakeside Hearing Centre', 'Bring her old hearing aids so they can compare.',
     'needs_coverage', v_priya, null, null, v_priya,
     ((v_today - 7) + time '18:00') at time zone v_tz, v_hearing_asked, 2),
    -- Maya added it, then cancelled once the clinic moved it to next month.
    (i_eye_exam, v_circle, 'appointment', 'Eye exam',
     ((v_today + 3) + time '15:00') at time zone v_tz, ((v_today + 3) + time '15:30') at time zone v_tz,
     'Main Street Optometry', null,
     'cancelled', null, null, null, v_maya,
     ((v_today - 10) + time '20:00') at time zone v_tz, ((v_today - 3) + time '10:00') at time zone v_tz, 2),
    (i_grab_bar, v_circle, 'task', 'Fix the loose grab bar in the bathroom',
     ((v_today + 5) + time '12:00') at time zone v_tz, null, null,
     'Screws are in the drawer under the sink. Needs a Phillips screwdriver.',
     'needs_someone', null, null, null, v_daniel,
     ((v_today - 4) + time '17:30') at time zone v_tz, ((v_today - 4) + time '17:30') at time zone v_tz, 1),
    (i_home_care, v_circle, 'task', 'Call about home-care hours',
     ((v_today + 3) + time '12:00') at time zone v_tz, null, null,
     'Ask whether the morning visits can move to 9 am.',
     'needs_someone', null, null, null, v_maya,
     ((v_today - 1) + time '20:30') at time zone v_tz, ((v_today - 1) + time '20:30') at time zone v_tz, 1),
    -- Priya added it; Daniel took it and did it.
    (i_groceries, v_circle, 'task', 'Grocery run for Mom',
     ((v_today - 12) + time '12:00') at time zone v_tz, null, null, null,
     'completed', v_daniel, null, null, v_priya,
     ((v_today - 13) + time '10:00') at time zone v_tz, ((v_today - 12) + time '13:00') at time zone v_tz, 3);

  -- -------------------------------------------------------------------------
  -- Assignment and coverage requests
  -- -------------------------------------------------------------------------
  insert into public.assignment_requests (
    circle_id, item_id, assigner_id, assignee_id, status, created_at, resolved_at
  ) values
    (v_circle, i_cardiology, v_maya, v_daniel, 'accepted',
     ((v_today - 9) + time '19:00') at time zone v_tz, ((v_today - 8) + time '08:15') at time zone v_tz),
    (v_circle, i_prescription, v_daniel, v_maya, 'pending',
     ((v_today - 2) + time '12:20') at time zone v_tz, null);

  insert into public.coverage_requests (
    circle_id, item_id, requester_id, taken_by, status, created_at, resolved_at
  ) values
    (v_circle, i_physio_2, v_maya, v_daniel, 'taken', v_cover_asked, v_cover_taken),
    (v_circle, i_hearing, v_priya, null, 'open', v_hearing_asked, null);

  -- -------------------------------------------------------------------------
  -- History, so item detail can show "Added by" and "Completed by". Data
  -- matches what the RPCs write (log_item_event strips nulls): created
  -- {kind, state, assignee_id?, follow_up_of?}, accepted {assigner_id},
  -- claimed and completed {}, cancelled {previous_state}, coverage_requested
  -- {} and coverage_taken {previous_owner_id}.
  -- -------------------------------------------------------------------------
  insert into public.activity_events (circle_id, actor_id, type, item_id, data, at) values
    (v_circle, v_maya, 'created', i_cardiology,
     jsonb_build_object('kind', 'appointment', 'state', 'awaiting_acceptance', 'assignee_id', v_daniel),
     ((v_today - 9) + time '19:00') at time zone v_tz),
    (v_circle, v_daniel, 'accepted', i_cardiology, jsonb_build_object('assigner_id', v_maya),
     ((v_today - 8) + time '08:15') at time zone v_tz),
    (v_circle, v_daniel, 'completed', i_cardiology, '{}',
     ((v_today - 2) + time '12:00') at time zone v_tz),

    (v_circle, v_daniel, 'created', i_prescription,
     jsonb_build_object('kind', 'task', 'state', 'awaiting_acceptance', 'assignee_id', v_maya,
                        'follow_up_of', i_cardiology),
     ((v_today - 2) + time '12:20') at time zone v_tz),

    (v_circle, v_maya, 'created', i_physio_1,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'),
     ((v_today - 13) + time '09:00') at time zone v_tz),
    (v_circle, v_daniel, 'claimed', i_physio_1, '{}', ((v_today - 13) + time '12:30') at time zone v_tz),
    (v_circle, v_daniel, 'completed', i_physio_1, '{}', ((v_today - 6) + time '15:30') at time zone v_tz),

    (v_circle, v_maya, 'created', i_physio_2,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'),
     ((v_today - 13) + time '09:00') at time zone v_tz),
    (v_circle, v_maya, 'claimed', i_physio_2, '{}', ((v_today - 13) + time '09:05') at time zone v_tz),
    (v_circle, v_maya, 'coverage_requested', i_physio_2, '{}', v_cover_asked),
    (v_circle, v_daniel, 'coverage_taken', i_physio_2, jsonb_build_object('previous_owner_id', v_maya),
     v_cover_taken),

    (v_circle, v_maya, 'created', i_physio_3,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'),
     ((v_today - 13) + time '09:00') at time zone v_tz),
    (v_circle, v_maya, 'claimed', i_physio_3, '{}', ((v_today - 13) + time '09:05') at time zone v_tz),

    (v_circle, v_maya, 'created', i_physio_4,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'),
     ((v_today - 13) + time '09:00') at time zone v_tz),

    (v_circle, v_priya, 'created', i_meds_1,
     jsonb_build_object('kind', 'task', 'state', 'assigned', 'assignee_id', v_priya),
     ((v_today - 3) + time '09:00') at time zone v_tz),
    (v_circle, v_priya, 'completed', i_meds_1, '{}', ((v_today - 2) + time '19:15') at time zone v_tz),
    (v_circle, v_priya, 'created', i_meds_2,
     jsonb_build_object('kind', 'task', 'state', 'assigned', 'assignee_id', v_priya),
     ((v_today - 3) + time '09:00') at time zone v_tz),
    (v_circle, v_priya, 'created', i_meds_3,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 3) + time '09:00') at time zone v_tz),
    (v_circle, v_priya, 'created', i_meds_4,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 3) + time '09:00') at time zone v_tz),
    (v_circle, v_priya, 'created', i_meds_5,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 3) + time '09:00') at time zone v_tz),

    (v_circle, v_priya, 'created', i_hearing,
     jsonb_build_object('kind', 'appointment', 'state', 'assigned', 'assignee_id', v_priya),
     ((v_today - 7) + time '18:00') at time zone v_tz),
    (v_circle, v_priya, 'coverage_requested', i_hearing, '{}', v_hearing_asked),

    (v_circle, v_maya, 'created', i_eye_exam,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'),
     ((v_today - 10) + time '20:00') at time zone v_tz),
    (v_circle, v_maya, 'cancelled', i_eye_exam, jsonb_build_object('previous_state', 'needs_someone'),
     ((v_today - 3) + time '10:00') at time zone v_tz),

    (v_circle, v_daniel, 'created', i_grab_bar,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 4) + time '17:30') at time zone v_tz),

    (v_circle, v_maya, 'created', i_home_care,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 1) + time '20:30') at time zone v_tz),

    (v_circle, v_priya, 'created', i_groceries,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'),
     ((v_today - 13) + time '10:00') at time zone v_tz),
    (v_circle, v_daniel, 'claimed', i_groceries, '{}', ((v_today - 13) + time '11:00') at time zone v_tz),
    (v_circle, v_daniel, 'completed', i_groceries, '{}', ((v_today - 12) + time '13:00') at time zone v_tz);

  -- -------------------------------------------------------------------------
  -- Updates: two linked to an item, one not
  -- -------------------------------------------------------------------------
  insert into public.updates (circle_id, author_id, item_id, body, created_at) values
    (v_circle, v_daniel, i_physio_1,
     'Physio went well. Mom walked the whole hallway with just the cane, and the physio gave her two new exercises to do at home.',
     ((v_today - 6) + time '15:40') at time zone v_tz),
    (v_circle, v_priya, null,
     'Spent the afternoon with Mom. We did the crossword and she asked about everyone. She seems brighter this week.',
     ((v_today - 3) + time '17:00') at time zone v_tz),
    (v_circle, v_daniel, i_cardiology,
     'Dr. Patel says Mom''s heart rhythm is stable. She''s changing the dose of one prescription, so I''ve added a task to pick it up by Friday. Next check-up in three months.',
     ((v_today - 2) + time '12:15') at time zone v_tz);

  return v_circle;
end $$;

-- Service role only: task 4.2's reset_demo_circle() and its jobs call it.
revoke execute on function public.build_sample_circle() from public, anon, authenticated;
grant execute on function public.build_sample_circle() to service_role;
