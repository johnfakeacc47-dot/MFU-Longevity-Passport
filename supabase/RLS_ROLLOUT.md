# RLS Rollout — supabase/migrations/0001_enable_rls.sql

## TL;DR / WARNING

> This migration **CANNOT ship on its own**. It must go out together with:
>
> 1. the `admin-users` Edge Function (Decision #1), deployed and reachable;
> 2. a frontend build where `src/services/supabaseClient.ts` routes `getAllProfiles` / `updateProfile` / `deleteProfile` / `adminCreateUser` through `admin-users` instead of the anon/`adminSupabase` client;
> 3. a frontend build with `VITE_SUPABASE_SERVICE_ROLE_KEY` and the `adminSupabase` client removed.
>
> If you apply this migration while the current frontend is live, the **Admin > User Management** screen breaks: editing a user (role change) fails with `permission denied for column role`, and creating users fails (needs the service key). Leaderboard rows for users who have not enabled "Share Longevity Score" disappear.
>
> The leaked `service_role` key is compromised (Decision #3) — rotate it **AFTER** the frontend no longer bundles it, and update the Edge Function secret.

## What the migration does

- Enables RLS on `profiles`, `health_scores`, `challenges`, `team_members` (the only tables the browser touches; the NestJS backend is a separate Postgres DB and is unaffected).
- Per-user policies keyed on `auth.uid()`; `is_admin()` SECURITY DEFINER helper + admin full-access policies.
- Removes `role`, `total_points`, `longevity_score`, `mfu_id` from the anon+authenticated INSERT/UPDATE grants on `profiles` (privilege-escalation / leaderboard-spoof fix). These are writable only by `service_role` (Edge Functions).
- Adds `trg_recompute_profile_points` on `health_scores`: `profiles.total_points` is now always `SUM(health_scores.total)` for that user, maintained server-side.
- Bundles `handle_new_user()` + `on_auth_user_created` so every signup gets a `profiles` row with `role='student'` created server-side.
- Adds an optional `leaderboard_profiles` view (safe columns only) for the leaderboard.

## Recommended deploy order

1. Deploy `admin-users` Edge Function; set its secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Deploy the frontend build that (a) calls `admin-users` for user management, (b) drops `role`/`total_points` from the `Login.tsx` signup upsert, (c) removes the `total_points` PATCH block in `syncDailyScoreToSupabase`, (d) has no `VITE_SUPABASE_SERVICE_ROLE_KEY`.
3. Apply this migration (below).
4. Rotate the `service_role` key in the Supabase dashboard; update the `admin-users` and `delete-user` function secrets with the new value.
5. Run the verification queries.

## How to apply

### Option A — Supabase CLI

```
supabase link --project-ref fqcouucedkxgocktbcre
supabase db push        # applies supabase/migrations/0001_enable_rls.sql
```

### Option B — Dashboard SQL Editor

Dashboard > SQL Editor > paste the entire contents of `supabase/migrations/0001_enable_rls.sql` > Run. It runs as `postgres` in one transaction.

### Preflight

```
select to_regclass('public.profiles'), to_regclass('public.health_scores'),
       to_regclass('public.challenges'), to_regclass('public.team_members');
```

All four must be non-null. If a table is missing it has no data to protect — comment out its enable/grant/policy section.

## Verification (run after apply)

```
-- 1. RLS on
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('profiles','health_scores','challenges','team_members');
-- expect rowsecurity = true for all 4

-- 2. Policies present
select tablename, policyname, cmd from pg_policies where schemaname='public' order by tablename, policyname;
-- expect the ~16 policies created by the migration

-- 3. privileged columns not writable by clients
select grantee, privilege_type, column_name from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and grantee in ('anon','authenticated')
  and column_name in ('role','total_points','longevity_score','mfu_id');
-- expect ZERO rows
```

REST checks (use PostgREST with the anon key + a real user JWT):

- anon (no Authorization header): `GET /rest/v1/profiles?select=*` -> `[]`
- student A JWT: `GET /rest/v1/profiles?select=*` -> only A's row + rows where `is_score_public=true`
- student A JWT: `GET /rest/v1/health_scores?select=*` -> only rows with `user_id = A`
- student A JWT: `POST /rest/v1/health_scores {"user_id":"<B>","date":"2026-08-29","total":50}` -> 401/403 (violates WITH CHECK)
- student A JWT: `PATCH /rest/v1/profiles?id=eq.<A> {"role":"admin"}` -> error `permission denied for column role`
- student A JWT: `PATCH /rest/v1/profiles?id=eq.<A> {"name":"New Name"}` -> 200
- student A JWT: `GET /rest/v1/profiles?id=eq.<B>` where B is private -> `[]`
- admin JWT: `GET /rest/v1/profiles?select=*` -> all rows (`profiles_admin_all`)
- admin JWT via anon key: `PATCH /rest/v1/profiles?id=eq.<B> {"role":"staff"}` -> STILL denied (column privilege); must go through `admin-users` function
- Edge Function `delete-user` still deletes the auth user (service key bypasses RLS)
- Toggle `is_score_public` off in Privacy Settings -> your row disappears from another student's leaderboard
- Log a score -> `health_scores` row upserts and `select total_points from profiles where id=<me>` equals `select sum(total) from health_scores where user_id=<me>`

## Per-role test matrix

| Actor | profiles | health_scores | challenges | team_members |
|---|---|---|---|---|
| anon (logged out) | no read, no write | none | none | none |
| student — own data | read full own row; INSERT/UPDATE own row EXCEPT role/total_points/longevity_score/mfu_id; DELETE own row | full CRUD where user_id = self | full CRUD where user_id = self | SELECT where user_id=self OR member_id=self; INSERT/UPDATE/DELETE where user_id=self |
| student — another student | sees their row ONLY if is_score_public=true (and then the whole row — see limitations); cannot write | no access | no access | cannot see another owner's edges |
| admin | read/UPDATE/DELETE all rows via is_admin() — BUT from the browser still cannot write role/total_points/longevity_score/mfu_id (column privilege); those go through admin-users Edge Function | all rows | all rows | all rows |
| service_role (Edge Functions) | bypasses RLS; full column access | full | full | full |

## Known limitations / behavior changes

1. Users who have not enabled "Share Longevity Score" no longer appear in the Team page leaderboard AT ALL (previously shown as "Private"). This affects both the "My Team" and "All Teams" tabs. This is the privacy-correct behavior; if you want teammates visible-but-hidden-score, add a team-scoped SELECT policy in a follow-up.
2. `profiles_select_public` exposes the ENTIRE row of opted-in users (email, phone, id_number, address, birth_date) to any authenticated user. Mitigation shipped: the `leaderboard_profiles` view. Switch `getLeaderboard`/`getMyTeamLeaderboard` to it and then drop `profiles_select_public`.
3. Dev Quick Login (`DevLoginModal`) creates only a localStorage session, no Supabase JWT. Under RLS every Supabase-backed screen reads empty for a dev-login user. Use a real Supabase login to test data flows.
4. `syncDailyScoreToSupabase`'s direct `profiles.total_points` PATCH now returns a permission error that the FE ignores; `trg_recompute_profile_points` keeps the value correct. Remove that FE block (see fe cluster).
5. Pre-existing bug (not caused by RLS): `deleteUserAccount` filters `health_scores` by `id` instead of `user_id`, so health rows are never deleted on account deletion. The DELETE policy is correct for when that bug is fixed.

## Rollback

Paste the ROLLBACK block from the bottom of `0001_enable_rls.sql` into the SQL Editor. It disables RLS on the 4 tables and restores broad grants. WARNING: rolling back re-opens the anon-key read/write hole — only do it if the frontend still bundles the service_role key.
