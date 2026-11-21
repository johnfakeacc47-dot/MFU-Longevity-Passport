-- ============================================================================
-- Bug: adding a teammate — whether by scanning someone's QR or typing their
-- invite code — only ever inserted one direction into team_members:
-- (caller, target). That means sharing YOUR OWN QR and having a friend
-- scan + confirm it added YOU to THEIR team, but never added THEM to
-- yours, so the person who shared the QR never sees a new teammate on
-- their own "My Team" tab (getMyTeamLeaderboard() reads rows where
-- user_id = the current user).
--
-- Confirmed live before this fix: two different users each added the same
-- third profile via add_team_member_by_handle(); that third profile never
-- once appeared as `user_id` in team_members, so their own team stayed
-- empty even though two people had "added" them.
--
-- Fix: teammates are mutual. Adding one now inserts both directions in the
-- same call, and this migration backfills the reverse edge for every
-- existing one-directional row so already-added teammates show up
-- immediately, without anyone re-adding each other.
-- ============================================================================

create or replace function public.add_team_member_by_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  target record;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select id, name, avatar_url into target
  from public.profiles
  where handle = lower(trim(p_handle))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if target.id = me then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  begin
    insert into public.team_members (user_id, member_id) values (me, target.id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end;

  -- Mutual: make sure the reverse edge exists too. `on conflict do nothing`
  -- because someone may have already added the reverse direction earlier.
  insert into public.team_members (user_id, member_id) values (target.id, me)
  on conflict (user_id, member_id) do nothing;

  return jsonb_build_object('ok', true, 'name', target.name, 'avatar_url', target.avatar_url);
end;
$$;

-- Backfill: make every existing one-directional edge mutual, so people who
-- were added before this fix immediately see their new teammate too.
insert into public.team_members (user_id, member_id)
select tm.member_id, tm.user_id
from public.team_members tm
on conflict (user_id, member_id) do nothing;
