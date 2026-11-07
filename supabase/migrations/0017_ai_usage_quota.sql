-- ============================================================================
-- Per-user daily quota for the paid AI Edge Functions (and other abusable RPCs).
--
-- recognize-food, health-chat and health-insights each call a paid model on
-- behalf of whoever holds a valid JWT. Nothing capped how often one account
-- could do that: a single logged-in user with a loop could run the Anthropic
-- bill up until the key hit its own limit, at which point every other user's
-- AI features went down too (the functions already translate that upstream
-- 429 / "credit balance" into a 503 for everyone). The cap has to live
-- server-side — the browser is the untrusted party here.
--
-- One counter row per (user, kind, Bangkok day). The Edge Functions call
-- consume_ai_quota() through the service-role client AFTER verifying the
-- caller's JWT, and return 429 { error: 'quota_exceeded' } when it says no.
-- The table has RLS on and no grants to anon/authenticated at all, so nothing
-- from the browser can read or reset the counters; the function is
-- service_role-only for the same reason (a client that could call it would
-- be able to burn its own quota, harmless, but also any other user's — the
-- p_user_id argument is trusted, which is exactly why only the server may
-- pass it).
--
-- `kind` is free text on purpose so the same table serves other rate limits
-- (0019 uses kind 'handle_lookup' for find_profile_by_handle) without a
-- second table of the same shape. Rows are tiny (one per user/kind/day) and
-- are left in place; purge old days with pg_cron later if the table ever
-- matters, e.g. `delete from public.ai_usage where day < current_date - 90`.
-- ============================================================================

create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  day     date not null,
  calls   int  not null default 0,
  primary key (user_id, kind, day)
);

alter table public.ai_usage enable row level security;
-- No policies and no grants: anon/authenticated get nothing (PostgREST would
-- 42501 on the table before RLS even applies). service_role bypasses RLS and
-- only ever reaches the table via consume_ai_quota() anyway.
revoke all on table public.ai_usage from public, anon, authenticated;

-- Increment-and-check in one statement. Returns true while the caller is
-- within p_max for today, false once the counter has gone past it. The
-- counter still increments on a refused call, which is what we want: hammering
-- a closed quota does not reopen it. "Today" is the Bangkok date so the
-- window rolls over at the same local midnight as the rest of the app
-- (bkkToday() in the functions, run_scheduled_reminders() in 0008).
create or replace function public.consume_ai_quota(p_user_id uuid, p_kind text, p_max int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  if p_user_id is null or p_kind is null or p_kind = '' or p_max is null or p_max < 0 then
    return false;
  end if;

  insert into public.ai_usage (user_id, kind, day, calls)
  values (p_user_id, p_kind, (now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (user_id, kind, day) do update
    set calls = ai_usage.calls + 1
  returning calls into n;

  return n <= p_max;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, int) to service_role;
