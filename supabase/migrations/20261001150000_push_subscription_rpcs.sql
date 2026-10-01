-- Push subscriptions (task 1.4, plan §4.2, ADR-010). The app saves and removes
-- the caller's own browser push subscription through these RPCs; it never
-- writes push_subscriptions directly. The push-test Edge Function reads the
-- table with the service role.

-- Saves the caller's push subscription. An endpoint belongs to one browser on
-- one device, so saving an endpoint that is already stored (even under another
-- account that signed in on the same phone) moves it to the caller and
-- refreshes its keys.
create function public.save_push_subscription(endpoint text, keys jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_member';
  end if;

  if save_push_subscription.endpoint is null
     or save_push_subscription.endpoint !~ '^https://'
     or length(save_push_subscription.endpoint) > 2048
     or jsonb_typeof(save_push_subscription.keys) is distinct from 'object'
     or jsonb_typeof(save_push_subscription.keys -> 'p256dh') is distinct from 'string'
     or jsonb_typeof(save_push_subscription.keys -> 'auth') is distinct from 'string' then
    raise exception 'invalid_input';
  end if;

  -- push_subscriptions.user_id references profiles; make sure the caller has one.
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  insert into public.push_subscriptions as s (user_id, endpoint, keys)
  values (
    uid,
    save_push_subscription.endpoint,
    jsonb_build_object(
      'p256dh', save_push_subscription.keys ->> 'p256dh',
      'auth', save_push_subscription.keys ->> 'auth'
    )
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id, keys = excluded.keys;
end $$;

-- Removes one of the caller's push subscriptions, e.g. when they turn push off
-- on this device. Does nothing if the endpoint isn't theirs.
create function public.delete_push_subscription(endpoint text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.push_subscriptions s
  where s.endpoint = delete_push_subscription.endpoint
    and s.user_id = auth.uid();
end $$;

revoke execute on function
  public.save_push_subscription(text, jsonb),
  public.delete_push_subscription(text)
from public, anon, authenticated;

grant execute on function
  public.save_push_subscription(text, jsonb),
  public.delete_push_subscription(text)
to authenticated;
