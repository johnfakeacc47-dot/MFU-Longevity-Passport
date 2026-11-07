-- Restored from the live project (supabase_migrations.schema_migrations,
-- version 20260914074525). Applied directly, never committed. Supersedes the
-- get_team_profiles() definition in 0015_privacy_hardening.sql.

-- The linter correctly flags "security definer view" as something it can't
-- verify is safe (views bypass the base table's RLS by default, same as
-- leaderboard_profiles already did before this session — that tradeoff was
-- already deliberately made and documented there). Rather than lean on that
-- same not-easily-auditable pattern again, swap team_profiles for a
-- SECURITY DEFINER FUNCTION instead — the same, already-reviewed pattern
-- used by every other relationship-scoped query in this project
-- (find_profile_by_handle, list_pending_team_requests, etc.), which the
-- linter reports as an accepted WARN, not an ERROR.
drop view if exists public.team_profiles;

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
