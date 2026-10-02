-- Task 3.2: sharing (PRD Epic 9, ADR-011).
--
-- Fills in the log_share stub from the initial migration. The app calls it
-- after the phone's share sheet reports an item was shared, so the item's
-- history shows it. It changes nothing else: no state change, no version
-- check, no outbox row. Kindred never sees what was sent or to whom.
--
-- The signature doesn't change, so `create or replace` keeps the grant from
-- the initial migration.

-- ---------------------------------------------------------------------------
-- log_share: one activity_events row of type 'shared' with {share_kind}.
-- share_kind is one of the app's item share builders (web/src/lib/
-- share-text.ts, ITEM_SHARE_KINDS). Raises not_member if the item doesn't
-- exist or isn't in the caller's circle (checked first, so non-members learn
-- nothing), and invalid_input for any other share_kind.
-- ---------------------------------------------------------------------------

create or replace function public.log_share(item_id uuid, share_kind text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items;
begin
  select i.* into v_item
  from public.items i
  where i.id = log_share.item_id and i.circle_id = public.current_circle_id();
  if not found then
    raise exception 'not_member';
  end if;

  if log_share.share_kind is null
    or log_share.share_kind not in ('task', 'appointment', 'assignment_request', 'coverage_request') then
    raise exception 'invalid_input';
  end if;

  perform public.log_item_event(v_item, auth.uid(), 'shared',
    jsonb_build_object('share_kind', log_share.share_kind));
end $$;
