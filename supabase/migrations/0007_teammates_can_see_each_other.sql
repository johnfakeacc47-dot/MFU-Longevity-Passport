-- ============================================================================
-- Bug: adding a private-score teammate made them vanish from "My Team"
-- entirely, not just hide their points.
--
-- profiles RLS only ever allowed seeing your OWN row, or another row when
-- is_score_public = true (profiles_select_public). getMyTeamLeaderboard()
-- then read from `leaderboard_profiles`, a view hard-filtered to
-- `WHERE is_score_public IS TRUE` (see 0001). So a teammate who hasn't
-- opted into public scores was invisible at both layers -- not just their
-- points, their entire row -- even though team_members correctly linked
-- you to them (confirmed live: the mutual team_members rows existed, but
-- the member simply never came back from the query).
--
-- The frontend (Team.tsx's mapMember) already expects and handles this
-- correctly -- `points: m.is_score_public ? m.total_points : null`, with a
-- "Private" lock badge for the null case -- it just never had a row to
-- work with. So this was dead code, not a bug in the UI.
--
-- Fix: "My Team" is a mutual, opted-in relationship (you both explicitly
-- added each other, per 0006), which is a different trust boundary than
-- "the public leaderboard". Teammates can now see each other's basic
-- profile row regardless of is_score_public; getMyTeamLeaderboard() (see
-- accompanying frontend change) reads straight from `profiles` instead of
-- the public-only `leaderboard_profiles` view. The public "All Teams"
-- leaderboard is untouched -- it keeps using `leaderboard_profiles` on
-- purpose, since that one *should* only ever show opted-in scores.
-- ============================================================================

create policy "profiles_select_teammates" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.user_id = (select auth.uid()) and tm.member_id = profiles.id
    )
    or exists (
      select 1 from public.team_members tm
      where tm.member_id = (select auth.uid()) and tm.user_id = profiles.id
    )
  );
