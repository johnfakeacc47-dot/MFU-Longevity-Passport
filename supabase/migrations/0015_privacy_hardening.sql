-- ============================================================================
-- Privacy audit fix, two real issues found and confirmed live:
--
-- 1. profiles_select_public / profiles_select_teammates grant the WHOLE
--    profiles row via RLS — not just name/avatar/points. profiles has real
--    PII (email, phone, id_number, address, birth_date, mfu_id, faculty,
--    department...) that nothing in the UI, and nothing the "Share Longevity
--    Score" toggle says, ever promises to share. This was flagged back in
--    supabase/RLS_ROLLOUT.md ("Known limitations" #2) with a partial fix
--    shipped (the leaderboard_profiles view) but the dangerous policy itself
--    was never dropped. Confirmed live with two throwaway accounts: an
--    unrelated authenticated user could `select *` a public-score user's row
--    and get their phone number, national ID, and home address.
--    getLeaderboard() already reads leaderboard_profiles, not the raw table
--    (already safe). getMyTeamLeaderboard() is switched to a new equivalent
--    view for the teammate case in this same change.
--
-- 2. deleteUserAccount() manually deleted from ['team_members', 'health_scores',
--    'profiles'] one table at a time as the calling user (authenticated role).
--    That's a list that has to be hand-kept in sync with every new
--    user-owned table forever, and it already silently broke this session:
--    team_members' direct DELETE grant for authenticated was revoked in
--    0013_team_request_approval.sql (closing a different privacy hole), so
--    the very first table in that loop now fails with permission denied and
--    account deletion never even reaches health_scores or profiles — right
--    now, "Delete My Account" is completely broken for a real user.
--
--    Every user-owned table already has ON DELETE CASCADE FROM profiles.id
--    (team_members, health_scores, notifications, push_subscriptions,
--    notification_preferences, team_requests, challenges) — checked live.
--    ai_reports/chat_messages/daily_logs are the exception: they cascade from
--    auth.users.id instead (also checked live), which is why the frontend's
--    Part 2 (the delete-user Edge Function, which removes the auth.users row
--    via the Admin API) is still needed alongside this — deleting profiles
--    alone was never meant to reach those three.
--
--    Fixed by running the profiles delete through a SECURITY DEFINER RPC, so
--    the cascade doesn't depend on whatever grants the calling role happens
--    to have on any one child table.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Stop granting full-row profiles access to non-owners.
-- --------------------------------------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_teammates" on public.profiles;

-- Safe-columns-only replacement for the teammate case (mirrors
-- leaderboard_profiles, minus its is_score_public filter — a teammate should
-- show up here even without opting into the public leaderboard, per 0007).
-- A plain view here would bypass the base table's RLS the same way
-- leaderboard_profiles already does (an accepted, deliberate tradeoff there)
-- — but the Supabase linter flags that pattern as ERROR-level
-- ("security definer view", unverifiable from the outside), so this uses a
-- SECURITY DEFINER FUNCTION instead: the same, already-reviewed pattern as
-- every other relationship-scoped query in this project
-- (find_profile_by_handle, list_pending_team_requests, ...), which the
-- linter reports as an accepted WARN rather than an ERROR.
create or replace function public.get_team_profiles(p_ids uuid[])
returns table (
  id uuid, name text, avatar_url text, role text,
  total_points integer, is_score_public boolean, handle text
)
language sql
security definer
set search_path to 'public'
as $$
  select p.id, p.name, p.avatar_url, p.role, p.total_points, p.is_score_public, p.handle
  from public.profiles p
  where p.id = any(p_ids)
    and (
      p.id = auth.uid()
      or exists (select 1 from public.team_members tm where tm.user_id = auth.uid() and tm.member_id = p.id)
      or exists (select 1 from public.team_members tm where tm.member_id = auth.uid() and tm.user_id = p.id)
    );
$$;
revoke all on function public.get_team_profiles(uuid[]) from public, anon;
grant execute on function public.get_team_profiles(uuid[]) to authenticated;

-- --------------------------------------------------------------------------
-- 2. Fix account deletion: one RPC, deletes only the profiles row (its
--    cascades handle everything else that hangs off profiles.id).
-- --------------------------------------------------------------------------
create or replace function public.delete_own_account_data()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  delete from public.profiles where id = me;
end;
$$;
revoke all on function public.delete_own_account_data() from public, anon;
grant execute on function public.delete_own_account_data() to authenticated;
