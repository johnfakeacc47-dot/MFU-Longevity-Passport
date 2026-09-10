-- Advisors flagged these three trigger-only functions as directly callable
-- via /rest/v1/rpc/... by anon/authenticated (Postgres grants EXECUTE to
-- PUBLIC by default on new functions). None of them need that — trigger
-- firing doesn't require EXECUTE on the triggering role, and
-- trigger_send_reminders is only meant to be invoked by the pg_cron job
-- (which runs as the function owner). Locking them down the same way
-- 0001_enable_rls.sql already locks down recompute_profile_points().
revoke all on function public.trigger_check_team_challenge() from public, anon, authenticated;
revoke all on function public.trigger_push_on_notification() from public, anon, authenticated;
revoke all on function public.trigger_send_reminders() from public, anon, authenticated;
