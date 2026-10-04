-- Task 4.5d: notification preferences (PRD US 11.4, plan §4.1).
--
-- notification_prefs holds one push switch per category. Members never write
-- it directly; these RPCs read and save the caller's own row.

-- The caller's switches. A member who never opened the settings has no row, so
-- they get the table's defaults (the same ones the outbox worker applies).
create function public.my_notification_prefs()
returns table (
  requests boolean,
  reminders boolean,
  changes boolean,
  updates boolean,
  weekly_summary boolean,
  comments boolean,
  everything_else boolean
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;

  return query
    select p.requests, p.reminders, p.changes, p.updates,
           p.weekly_summary, p.comments, p.everything_else
    from public.notification_prefs p
    where p.user_id = v_user
    union all
    select true, true, true, true, true, true, false
    where not exists (select 1 from public.notification_prefs p where p.user_id = v_user);
end $$;

-- Turns one category's push on or off for the caller, creating their row (with
-- the defaults for the other categories) if needed. Returns the new switches.
create function public.set_notification_pref(category text, enabled boolean)
returns table (
  requests boolean,
  reminders boolean,
  changes boolean,
  updates boolean,
  weekly_summary boolean,
  comments boolean,
  everything_else boolean
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_member';
  end if;
  if set_notification_pref.enabled is null
     or set_notification_pref.category is null
     or set_notification_pref.category not in (
       'requests', 'reminders', 'changes', 'updates',
       'weekly_summary', 'comments', 'everything_else'
     ) then
    raise exception 'invalid_input';
  end if;

  -- notification_prefs.user_id references profiles; make sure the caller has one.
  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  insert into public.notification_prefs (user_id) values (v_user) on conflict (user_id) do nothing;

  -- The category was checked above, so building the column name is safe.
  execute format(
    'update public.notification_prefs set %I = $1 where user_id = $2',
    set_notification_pref.category
  ) using set_notification_pref.enabled, v_user;

  return query select * from public.my_notification_prefs();
end $$;

revoke execute on function
  public.my_notification_prefs(),
  public.set_notification_pref(text, boolean)
from public, anon, authenticated;

grant execute on function
  public.my_notification_prefs(),
  public.set_notification_pref(text, boolean)
to authenticated;
