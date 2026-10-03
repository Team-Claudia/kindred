-- Task 4.1: post an update (PRD US 10.1, plan §4.2, ADR-010).
--
-- Fills in the post_update stub from the initial migration. An update is a
-- short report for the whole circle ("Back from cardiology, next visit in six
-- weeks"), optionally linked to one task or appointment. In one transaction it:
-- 1. checks the caller is in a circle (not_member);
-- 2. checks the body (not blank, at most 2,000 characters) and that a linked
--    item is in the caller's circle (invalid_input);
-- 3. inserts the updates row, with the body trimmed;
-- 4. appends one activity_events row, type update_posted, data {update_id},
--    with item_id when linked;
-- 5. queues one push outbox job for every other member, event update_posted.
--    The payload carries IDs only (update_id, and item_id when linked), never
--    the update's text (ADR-010).
--
-- The signature doesn't change, so `create or replace` keeps the grant from
-- the initial migration.

create or replace function public.post_update(body text, item_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_circle uuid := public.current_circle_id();
  v_body text := nullif(btrim(post_update.body), '');
  v_id uuid;
begin
  if v_circle is null then
    raise exception 'not_member';
  end if;

  if v_body is null or char_length(v_body) > 2000 then
    raise exception 'invalid_input';
  end if;
  if post_update.item_id is not null and not exists (
    select 1 from public.items i
    where i.id = post_update.item_id and i.circle_id = v_circle
  ) then
    raise exception 'invalid_input';
  end if;

  insert into public.updates (circle_id, author_id, item_id, body)
  values (v_circle, v_user, post_update.item_id, v_body)
  returning id into v_id;

  insert into public.activity_events (circle_id, actor_id, type, item_id, data)
  values (v_circle, v_user, 'update_posted', post_update.item_id,
    jsonb_build_object('update_id', v_id));

  -- One push job per other member (plan §4.4). jsonb_strip_nulls leaves
  -- item_id out of an unlinked update's payload.
  insert into public.outbox (circle_id, kind, payload)
  select
    v_circle,
    'push',
    jsonb_strip_nulls(jsonb_build_object(
      'event', 'update_posted',
      'update_id', v_id,
      'item_id', post_update.item_id,
      'recipient_id', cm.user_id,
      'actor_id', v_user
    ))
  from public.circle_members cm
  where cm.circle_id = v_circle
    and cm.user_id is distinct from v_user;

  return v_id;
end $$;
