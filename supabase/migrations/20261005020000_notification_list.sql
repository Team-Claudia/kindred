-- Task 4.5f: the in-app notification list (PRD US 11.6, plan §4.2, §4.3,
-- ADR-010).
--
-- outbox-worker already writes a notifications row for every recipient,
-- push or not. This lets each member read their own rows (the list at
-- /notifications and the bell's unread count on Home), hear about changes to
-- them over Realtime, and mark them read.

-- Each member reads only their own notifications. No write policies: the
-- worker writes rows with the service role, and members mark them read
-- through mark_notifications_read().
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The bell's unread count stays live: Realtime sends a member the inserts
-- and updates to their own rows (it checks the select policy above), so a
-- new notification, or marking read on another phone, updates the badge.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- Unread first, for the bell's count.
create index notifications_user_id_unread_idx on public.notifications (user_id)
  where read_at is null;

-- Marks one of the caller's notifications read, or all of them when
-- notification_id is omitted. Only the caller's own rows change: someone
-- else's ID, an unknown ID or one already read does nothing.
create or replace function public.mark_notifications_read(notification_id bigint default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.notifications n
  set read_at = now()
  where n.user_id = (select auth.uid())
    and n.read_at is null
    and (mark_notifications_read.notification_id is null
         or n.id = mark_notifications_read.notification_id);
end $$;
