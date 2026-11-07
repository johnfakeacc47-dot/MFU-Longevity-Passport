-- Restored from the live project (supabase_migrations.schema_migrations,
-- version 20260907102437). This was applied directly to the database and
-- never committed, so the repo had drifted from production.

-- leaderboard_profiles: run with the querying user's RLS, not the definer's.
-- profiles_select_public already lets authenticated users see is_score_public rows,
-- so the view still works; this clears the security_definer_view ERROR.
alter view public.leaderboard_profiles set (security_invoker = true);

-- Pure trigger functions - never meant to be called via the REST RPC endpoint.
-- Triggers fire with the table owner's rights regardless of these grants.
revoke all on function public.handle_new_user() from public;
revoke all on function public.recompute_profile_points() from public;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
