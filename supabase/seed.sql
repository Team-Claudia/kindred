-- Local development seed (task 2.5). Development only: `supabase db reset`
-- loads it locally (and in CI); it is never loaded into the hosted project.
-- It is not the sample circle behind Try the demo (task 4.2).
--
-- Who's in it: the wireframes' example family, caring for Dad (Parent) in a
-- circle on America/Vancouver time. The people are fictional.
--
--   Circle  5eed0000-0000-4000-8000-000000000100  Dad
--   Maya    5eed0000-0000-4000-8000-000000000001  maya@example.com   admin
--   Jonah   5eed0000-0000-4000-8000-000000000002  jonah@example.com  member
--   Ada     5eed0000-0000-4000-8000-000000000003  ada@example.com    member
--
-- Items have fixed IDs 5eed0000-0000-4000-8000-0000000002xx (see below) and
-- dates relative to now(), so Home and This week always look current. Every
-- state is covered, plus one Overdue item and one due today.
--
-- Signing in as one of them locally:
--   1. `supabase start` (or `supabase db reset` to start over), then
--      `npm run dev` in web/ with VITE_SUPABASE_URL=http://127.0.0.1:54321 and
--      VITE_SUPABASE_ANON_KEY set to the anon key `supabase status` prints.
--   2. Choose Email me a code and enter e.g. maya@example.com.
--   3. No real email is sent: open the local mail viewer at
--      http://127.0.0.1:54324, find the message to that address and copy the
--      6-digit code into the app.
--
-- The seed runs as the database owner and inserts rows directly. That's only
-- acceptable here; the app always changes data through RPCs. Rows follow the
-- PRD §17 rules: owner_id is the confirmed owner (Assigned, Needs coverage,
-- Completed), proposed_assignee_id is set only while Awaiting acceptance, and
-- each item has at most one pending assignment request and one open coverage
-- request.

do $seed$
declare
  v_tz constant text := 'America/Vancouver';
  -- Today in the circle's time zone; local times below are built from it.
  v_today date := (now() at time zone 'America/Vancouver')::date;

  v_circle constant uuid := '5eed0000-0000-4000-8000-000000000100';
  v_maya constant uuid := '5eed0000-0000-4000-8000-000000000001';
  v_jonah constant uuid := '5eed0000-0000-4000-8000-000000000002';
  v_ada constant uuid := '5eed0000-0000-4000-8000-000000000003';

  i_pharmacy constant uuid := '5eed0000-0000-4000-8000-000000000201';   -- Awaiting acceptance (asked of Maya), due today
  i_cardiology constant uuid := '5eed0000-0000-4000-8000-000000000202'; -- Assigned (Maya accepted), appointment
  i_refill constant uuid := '5eed0000-0000-4000-8000-000000000203';     -- Assigned (Jonah claimed), Overdue
  i_physio constant uuid := '5eed0000-0000-4000-8000-000000000204';     -- Needs someone (Jonah declined), appointment
  i_groceries constant uuid := '5eed0000-0000-4000-8000-000000000205';  -- Completed by Ada
  i_flu_shot constant uuid := '5eed0000-0000-4000-8000-000000000206';   -- Awaiting acceptance (asked of Ada)
  i_hearing constant uuid := '5eed0000-0000-4000-8000-000000000207';    -- Needs coverage (Jonah), appointment
  i_dentist constant uuid := '5eed0000-0000-4000-8000-000000000208';    -- Cancelled, appointment
  i_gp constant uuid := '5eed0000-0000-4000-8000-000000000209';         -- Completed appointment (Maya)
  i_blood_test constant uuid := '5eed0000-0000-4000-8000-000000000210'; -- Follow-up of the GP visit, Assigned (Ada claimed)

  -- Due later today but not yet overdue (late-night resets clamp to 23:59).
  v_due_today timestamptz := least(
    greatest((v_today + time '17:00') at time zone v_tz, now() + interval '1 hour'),
    (v_today + time '23:59') at time zone v_tz
  );
  v_overdue timestamptz := ((v_today - 1) + time '17:00') at time zone v_tz;
  v_cardiology timestamptz := ((v_today + 1) + time '14:00') at time zone v_tz;
  v_physio timestamptz := ((v_today + 2) + time '09:30') at time zone v_tz;
  v_flu_shot timestamptz := ((v_today + 3) + time '17:00') at time zone v_tz;
  v_hearing timestamptz := ((v_today + 4) + time '10:30') at time zone v_tz;
  v_dentist timestamptz := ((v_today + 5) + time '11:00') at time zone v_tz;
  v_gp timestamptz := ((v_today - 3) + time '10:00') at time zone v_tz;
  v_blood_test timestamptz := ((v_today + 6) + time '12:00') at time zone v_tz;
  v_groceries_done timestamptz := now() - interval '3 hours';
begin
  -- -------------------------------------------------------------------------
  -- Accounts. handle_new_user creates each profile and takes the display name
  -- from full_name. The empty token strings stop GoTrue failing on NULLs, and
  -- the email identity lets Email me a code find the existing account.
  -- -------------------------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
    now() - interval '30 days',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', u.full_name),
    now() - interval '30 days', now() - interval '30 days',
    '', '', '', ''
  from (values
    (v_maya, 'maya@example.com', 'Maya Reyes'),
    (v_jonah, 'jonah@example.com', 'Jonah Reyes'),
    (v_ada, 'ada@example.com', 'Ada Reyes')
  ) as u (id, email, full_name);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select
    gen_random_uuid(), u.id, u.id::text, 'email',
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    now() - interval '30 days', now() - interval '30 days', now() - interval '30 days'
  from auth.users u
  where u.id in (v_maya, v_jonah, v_ada);

  -- -------------------------------------------------------------------------
  -- The circle. Dad is each member's Parent.
  -- -------------------------------------------------------------------------
  insert into public.circles (id, care_recipient_name, time_zone, created_at)
  values (v_circle, 'Dad', v_tz, now() - interval '30 days');

  insert into public.circle_members (circle_id, user_id, role, relationship, joined_at) values
    (v_circle, v_maya, 'admin', 'Parent', now() - interval '30 days'),
    (v_circle, v_jonah, 'member', 'Parent', now() - interval '29 days'),
    (v_circle, v_ada, 'member', 'Parent', now() - interval '28 days');

  insert into public.activity_events (circle_id, actor_id, type, at) values
    (v_circle, v_maya, 'circle_created', now() - interval '30 days'),
    (v_circle, v_jonah, 'member_joined', now() - interval '29 days'),
    (v_circle, v_ada, 'member_joined', now() - interval '28 days');

  -- -------------------------------------------------------------------------
  -- Items
  -- -------------------------------------------------------------------------
  insert into public.items (
    id, circle_id, kind, title, starts_at, ends_at, location, private_notes,
    state, owner_id, proposed_assignee_id, follow_up_of, created_by, created_at, updated_at, version
  ) values
    -- Ada added it asking Maya; waiting for Maya. Due today.
    (i_pharmacy, v_circle, 'task', 'Call the pharmacy about the new dose schedule',
     v_due_today, null, null, null,
     'awaiting_acceptance', null, v_maya, null, v_ada,
     now() - interval '2 days', now() - interval '2 days', 1),
    -- Jonah added it asking Maya to drive; she accepted.
    (i_cardiology, v_circle, 'appointment', 'Cardiology appointment',
     v_cardiology, v_cardiology + interval '1 hour', 'Riverside Clinic, 4th floor', 'Bring the list of current medications.',
     'assigned', v_maya, null, null, v_jonah,
     now() - interval '6 days', now() - interval '5 days', 2),
    -- Jonah claimed it, and it's now past due: Overdue.
    (i_refill, v_circle, 'task', 'Refill blood pressure meds',
     v_overdue, null, null, 'Pharmacy on Fraser St. The repeat is already on file, just needs collecting.',
     'assigned', v_jonah, null, null, v_maya,
     now() - interval '4 days', now() - interval '4 days', 2),
    -- Maya asked Jonah, who declined, so it needs someone again.
    (i_physio, v_circle, 'appointment', 'Physio ride',
     v_physio, v_physio + interval '1 hour', 'Westside Physiotherapy', null,
     'needs_someone', null, null, null, v_maya,
     now() - interval '3 days', now() - interval '2 days', 3),
    -- Ada added it for herself and did it earlier today.
    (i_groceries, v_circle, 'task', 'Groceries drop-off',
     v_groceries_done - interval '1 hour', null, null, null,
     'completed', v_ada, null, null, v_ada,
     now() - interval '3 days', v_groceries_done, 2),
    -- Maya added it asking Ada; waiting for Ada.
    (i_flu_shot, v_circle, 'task', 'Book Dad''s flu shot',
     v_flu_shot, null, null, null,
     'awaiting_acceptance', null, v_ada, null, v_maya,
     now() - interval '1 day', now() - interval '1 day', 1),
    -- Jonah claimed it, then asked for coverage.
    (i_hearing, v_circle, 'appointment', 'Hearing test',
     v_hearing, v_hearing + interval '45 minutes', 'Eastside Hearing Centre', null,
     'needs_coverage', v_jonah, null, null, v_ada,
     now() - interval '7 days', now() - interval '1 day', 3),
    -- Ada added it, then cancelled it once the clinic moved the check-up.
    (i_dentist, v_circle, 'appointment', 'Dentist check-up',
     v_dentist, v_dentist + interval '30 minutes', 'Main Street Dental', null,
     'cancelled', null, null, null, v_ada,
     now() - interval '10 days', now() - interval '2 days', 2),
    -- Maya claimed and did it three days ago.
    (i_gp, v_circle, 'appointment', 'GP check-up',
     v_gp, v_gp + interval '30 minutes', 'Kingsway Family Practice', null,
     'completed', v_maya, null, null, v_maya,
     now() - interval '9 days', v_gp + interval '1 hour', 3),
    -- A follow-up to the GP visit, which Ada claimed.
    (i_blood_test, v_circle, 'task', 'Book the blood test the GP ordered',
     v_blood_test, null, null, null,
     'assigned', v_ada, null, i_gp, v_maya,
     v_gp + interval '2 hours', now() - interval '2 days', 2);

  -- -------------------------------------------------------------------------
  -- Assignment and coverage requests
  -- -------------------------------------------------------------------------
  insert into public.assignment_requests (
    circle_id, item_id, assigner_id, assignee_id, status, created_at, resolved_at
  ) values
    (v_circle, i_pharmacy, v_ada, v_maya, 'pending', now() - interval '2 days', null),
    (v_circle, i_cardiology, v_jonah, v_maya, 'accepted', now() - interval '6 days', now() - interval '5 days'),
    (v_circle, i_physio, v_maya, v_jonah, 'declined', now() - interval '3 days', now() - interval '2 days'),
    (v_circle, i_flu_shot, v_maya, v_ada, 'pending', now() - interval '1 day', null);

  insert into public.coverage_requests (circle_id, item_id, requester_id, status, created_at)
  values (v_circle, i_hearing, v_jonah, 'open', now() - interval '1 day');

  -- -------------------------------------------------------------------------
  -- History, so item detail can show "Added by" and "Completed by". Types and
  -- data match what the task 2.1 RPCs write (log_item_event strips nulls):
  -- created {kind, state, assignee_id?, follow_up_of?}, assigned {assignee_id},
  -- claimed (assigning yourself), accepted/declined {assigner_id}, completed,
  -- cancelled {previous_state}, and coverage_requested (task 3.1, no data).
  -- -------------------------------------------------------------------------
  insert into public.activity_events (circle_id, actor_id, type, item_id, data, at) values
    (v_circle, v_ada, 'created', i_pharmacy,
     jsonb_build_object('kind', 'task', 'state', 'awaiting_acceptance', 'assignee_id', v_maya),
     now() - interval '2 days'),

    (v_circle, v_jonah, 'created', i_cardiology,
     jsonb_build_object('kind', 'appointment', 'state', 'awaiting_acceptance', 'assignee_id', v_maya),
     now() - interval '6 days'),
    (v_circle, v_maya, 'accepted', i_cardiology, jsonb_build_object('assigner_id', v_jonah), now() - interval '5 days'),

    (v_circle, v_maya, 'created', i_refill,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone'), now() - interval '4 days'),
    (v_circle, v_jonah, 'claimed', i_refill, '{}', now() - interval '4 days'),

    (v_circle, v_maya, 'created', i_physio,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'), now() - interval '3 days'),
    (v_circle, v_maya, 'assigned', i_physio, jsonb_build_object('assignee_id', v_jonah), now() - interval '3 days'),
    (v_circle, v_jonah, 'declined', i_physio, jsonb_build_object('assigner_id', v_maya), now() - interval '2 days'),

    (v_circle, v_ada, 'created', i_groceries,
     jsonb_build_object('kind', 'task', 'state', 'assigned', 'assignee_id', v_ada), now() - interval '3 days'),
    (v_circle, v_ada, 'completed', i_groceries, '{}', v_groceries_done),

    (v_circle, v_maya, 'created', i_flu_shot,
     jsonb_build_object('kind', 'task', 'state', 'awaiting_acceptance', 'assignee_id', v_ada),
     now() - interval '1 day'),

    (v_circle, v_ada, 'created', i_hearing,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'), now() - interval '7 days'),
    (v_circle, v_jonah, 'claimed', i_hearing, '{}', now() - interval '7 days'),
    (v_circle, v_jonah, 'coverage_requested', i_hearing, '{}', now() - interval '1 day'),

    (v_circle, v_ada, 'created', i_dentist,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'), now() - interval '10 days'),
    (v_circle, v_ada, 'cancelled', i_dentist, jsonb_build_object('previous_state', 'needs_someone'),
     now() - interval '2 days'),

    (v_circle, v_maya, 'created', i_gp,
     jsonb_build_object('kind', 'appointment', 'state', 'needs_someone'), now() - interval '9 days'),
    (v_circle, v_maya, 'claimed', i_gp, '{}', now() - interval '9 days'),
    (v_circle, v_maya, 'completed', i_gp, '{}', v_gp + interval '1 hour'),

    (v_circle, v_maya, 'created', i_blood_test,
     jsonb_build_object('kind', 'task', 'state', 'needs_someone', 'follow_up_of', i_gp),
     v_gp + interval '2 hours'),
    (v_circle, v_ada, 'claimed', i_blood_test, '{}', now() - interval '2 days');

  -- -------------------------------------------------------------------------
  -- Updates: two linked to an item, one not
  -- -------------------------------------------------------------------------
  insert into public.updates (circle_id, author_id, item_id, body, created_at) values
    (v_circle, v_jonah, i_refill,
     'Stuck at work until seven. Can anyone else pick up the prescription before the pharmacy closes?',
     v_overdue + interval '1 hour 40 minutes'),
    (v_circle, v_ada, i_groceries,
     'Dropped the groceries off and put the milk away. Dad was in good spirits and ate lunch.',
     v_groceries_done + interval '5 minutes'),
    (v_circle, v_maya, null,
     'Dad slept well and was out for a short walk this morning.',
     now() - interval '1 day 2 hours');
end
$seed$;
