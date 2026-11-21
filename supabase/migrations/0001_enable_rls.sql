-- ============================================================================
-- supabase/migrations/0001_enable_rls.sql
-- Enable Row Level Security (RLS) + policies for every table the browser client
-- touches through supabase-js with the PUBLIC anon key.
--
-- WHY: the anon key is shipped in the frontend bundle. Today there are ZERO RLS
-- policies, so anyone who opens devtools can read & write every row of every
-- table (all users' health data, points, PII, team rosters).
--
-- SCOPE (only tables the frontend uses via supabase-js):
--   public.profiles       -- 1 row/user; PRIMARY KEY id == auth.users.id
--   public.health_scores  -- per-user daily scores;    fk column: user_id
--   public.challenges     -- per-user weekly check-ins; fk column: user_id
--   public.team_members   -- team edges; user_id = list owner, member_id = invitee
-- The NestJS backend uses a DIFFERENT Postgres DB (backend/.env DATABASE_URL ->
-- longevity_db), so its tables are NOT in this project and are out of scope.
--
-- >>> DEPLOY WITH the frontend service_role-key removal + the admin-users Edge
--     Function. Applying alone breaks Admin > User Management and hides
--     non-opted-in users from the leaderboard. See supabase/RLS_ROLLOUT.md.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. Column guards (idempotent) so the policies always have a valid column to
--    reference, even on a partially-set-up database.
-- --------------------------------------------------------------------------
alter table public.profiles add column if not exists is_score_public boolean not null default false;
alter table public.profiles alter column role set default 'student';

-- --------------------------------------------------------------------------
-- 1. is_admin() -- SECURITY DEFINER so it can read profiles.role without being
--    filtered by the very policies that call it (prevents recursion).
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
-- Only signed-in users (via policies) and Edge Functions need this. Not anon -
-- an anon caller would just get false, but keeping it off the public API surface
-- avoids a linter warning and shrinks the attack surface.
grant execute on function public.is_admin() to authenticated, service_role;

-- --------------------------------------------------------------------------
-- 2. Server-side profile bootstrap (bundled so this migration does not depend
--    on supabase/create_profile_trigger.sql being pasted in by hand). Forces
--    role='student' for every self-service signup.
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, total_points)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), 'student', 0)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- Trigger functions run with the definer's rights; nothing should call this via
-- the REST RPC endpoint.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- --------------------------------------------------------------------------
-- 3. profiles.total_points is SERVER-AUTHORITATIVE = SUM(health_scores.total).
--    The browser currently PATCHes it directly (supabaseClient.ts
--    syncDailyScoreToSupabase). After step 5 that PATCH is rejected by column
--    privilege and silently ignored by the FE; this trigger maintains the value.
-- --------------------------------------------------------------------------
create or replace function public.recompute_profile_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set total_points = coalesce(
       (select sum(hs.total) from public.health_scores hs where hs.user_id = target), 0)
   where p.id = target;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_recompute_profile_points on public.health_scores;
create trigger trg_recompute_profile_points
  after insert or update or delete on public.health_scores
  for each row execute function public.recompute_profile_points();
revoke execute on function public.recompute_profile_points() from anon, authenticated;

-- --------------------------------------------------------------------------
-- 4. Enable RLS
-- --------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.health_scores enable row level security;
alter table public.challenges    enable row level security;
alter table public.team_members  enable row level security;

-- --------------------------------------------------------------------------
-- 4a. Drop EVERY pre-existing policy on these tables. This project was set up
--     with permissive "Allow public all access" / "Allow public read access" /
--     "Users can ..." / "Public profiles are viewable by everyone" policies that
--     let the anon key read & write every row. PostgreSQL OR's permissive
--     policies, so unless those are removed the restrictive policies in step 6
--     are a complete no-op and the anon-key hole stays open.
-- --------------------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'health_scores', 'challenges', 'team_members')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 5. Table + column GRANTs
--    anon           -> nothing (RLS + no grant = fully locked out)
--    authenticated  -> rows gated by policies (step 6); privileged columns
--                      role / total_points / longevity_score / mfu_id removed
--                      from INSERT & UPDATE so a browser client can never
--                      escalate itself or spoof the leaderboard.
--    service_role   -> untouched (Edge Functions keep full access).
-- --------------------------------------------------------------------------
revoke all on public.profiles      from anon, authenticated;
revoke all on public.health_scores from anon, authenticated;
revoke all on public.challenges    from anon, authenticated;
revoke all on public.team_members  from anon, authenticated;

-- profiles: SELECT/DELETE at table level (rows gated by RLS); INSERT/UPDATE by
-- column, computed dynamically so future non-privileged columns are covered and
-- the migration never references a column that does not exist.
grant select, delete on public.profiles to authenticated;
do $$
declare cols text;
begin
  -- UPDATE: everything except identity / privileged / audit columns
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name='profiles'
    and column_name not in ('id','role','total_points','longevity_score','mfu_id','created_at','updated_at');
  execute format('grant update (%s) on public.profiles to authenticated', cols);
  -- INSERT: allow id (client supplies it; RLS WITH CHECK forces = auth.uid()),
  -- deny privileged / audit columns
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name='profiles'
    and column_name not in ('role','total_points','longevity_score','mfu_id','created_at','updated_at');
  execute format('grant insert (%s) on public.profiles to authenticated', cols);
end $$;

grant select, insert, update, delete on public.health_scores to authenticated;
grant select, insert, update, delete on public.challenges    to authenticated;
grant select, insert, update, delete on public.team_members  to authenticated;

-- --------------------------------------------------------------------------
-- 6. Policies (idempotent: drop-if-exists then create). Multiple permissive
--    policies on one command are OR'd.
-- --------------------------------------------------------------------------

-- === profiles ===
drop policy if exists "profiles_select_own"    on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_own"    on public.profiles;
drop policy if exists "profiles_update_own"    on public.profiles;
drop policy if exists "profiles_delete_own"    on public.profiles;
drop policy if exists "profiles_admin_all"     on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) );

-- Needed by the leaderboard (getLeaderboard / getMyTeamLeaderboard). Exposes the
-- WHOLE row of opted-in users. See RLS_ROLLOUT.md "Known limitations" and the
-- leaderboard_profiles view (step 7) for the recommended tightening.
create policy "profiles_select_public" on public.profiles
  for select to authenticated
  using ( is_score_public is true );

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ( id = (select auth.uid()) );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using ( id = (select auth.uid()) );

create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using ( (select public.is_admin()) )
  with check ( (select public.is_admin()) );

-- === health_scores ===
drop policy if exists "health_scores_own"       on public.health_scores;
drop policy if exists "health_scores_admin_all" on public.health_scores;

create policy "health_scores_own" on public.health_scores
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

create policy "health_scores_admin_all" on public.health_scores
  for all to authenticated
  using ( (select public.is_admin()) )
  with check ( (select public.is_admin()) );

-- === challenges (per-user check-ins) ===
drop policy if exists "challenges_own"       on public.challenges;
drop policy if exists "challenges_admin_all" on public.challenges;

create policy "challenges_own" on public.challenges
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

create policy "challenges_admin_all" on public.challenges
  for all to authenticated
  using ( (select public.is_admin()) )
  with check ( (select public.is_admin()) );

-- === team_members ===
drop policy if exists "team_members_select"     on public.team_members;
drop policy if exists "team_members_insert_own" on public.team_members;
drop policy if exists "team_members_update_own" on public.team_members;
drop policy if exists "team_members_delete_own" on public.team_members;
drop policy if exists "team_members_admin_all"  on public.team_members;

create policy "team_members_select" on public.team_members
  for select to authenticated
  using ( user_id = (select auth.uid()) or member_id = (select auth.uid()) );

create policy "team_members_insert_own" on public.team_members
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

create policy "team_members_update_own" on public.team_members
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

create policy "team_members_delete_own" on public.team_members
  for delete to authenticated
  using ( user_id = (select auth.uid()) );

create policy "team_members_admin_all" on public.team_members
  for all to authenticated
  using ( (select public.is_admin()) )
  with check ( (select public.is_admin()) );

-- --------------------------------------------------------------------------
-- 7. RECOMMENDED (optional): column-scoped leaderboard view so opted-in users
--    expose ONLY id/name/avatar/role/points, not their whole PII row. This view
--    intentionally runs with the definer's rights (default) and bypasses base
--    RLS. To adopt: keep this view, point getLeaderboard / getMyTeamLeaderboard
--    at 'leaderboard_profiles', THEN drop the "profiles_select_public" policy.
-- --------------------------------------------------------------------------
create or replace view public.leaderboard_profiles as
  select id, name, avatar_url, role, total_points, is_score_public
  from public.profiles
  where is_score_public is true;
revoke all on public.leaderboard_profiles from anon, authenticated;
grant select on public.leaderboard_profiles to authenticated;

-- ============================================================================
-- ROLLBACK (paste into the SQL Editor to fully revert):
--   alter table public.profiles      disable row level security;
--   alter table public.health_scores disable row level security;
--   alter table public.challenges    disable row level security;
--   alter table public.team_members  disable row level security;
--   grant all on public.profiles, public.health_scores, public.challenges,
--     public.team_members to authenticated;
--   drop view if exists public.leaderboard_profiles;
--   drop trigger if exists trg_recompute_profile_points on public.health_scores;
--   drop function if exists public.recompute_profile_points();
--   -- is_admin(), handle_new_user() and on_auth_user_created are safe to keep.
-- WARNING: disabling RLS re-opens the anon-key hole. Only roll back if the
-- frontend still depends on the service_role key.
-- ============================================================================
