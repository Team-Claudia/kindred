-- Task 4.3: Care Circle and settings. Members can change their own name from
-- "Your account". Everything else on the screen uses existing RPCs.

-- Saves the caller's name, as shown to their Care Circle. Blank or over 80
-- characters is invalid_input; signed out is not_member.
create function public.set_display_name(display_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(set_display_name.display_name), '');
begin
  if v_user is null then
    raise exception 'not_member';
  end if;
  if v_name is null then
    raise exception 'invalid_input';
  end if;

  -- Checks the length and creates the profile if it's somehow missing.
  perform public.save_profile(v_user, v_name);
end $$;

revoke execute on function public.set_display_name(text) from public, anon, authenticated;
grant execute on function public.set_display_name(text) to authenticated;
