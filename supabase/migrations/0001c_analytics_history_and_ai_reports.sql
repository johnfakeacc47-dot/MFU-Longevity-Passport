-- Restored from the live project (supabase_migrations.schema_migrations,
-- version 20260907140021). Applied directly, never committed — which is why
-- health_scores' aggregate columns and the ai_reports table existed only live.

-- ============================================================================
-- Turn health_scores into the authoritative per-user-per-day rollup, and add a
-- cache table for AI-generated period reports.
-- ============================================================================

-- 1. health_scores: one row per user per day (the app hand-rolled this check).
alter table public.health_scores
  add constraint health_scores_user_date_key unique (user_id, date);

-- 2. Daily aggregate columns the analytics page needs (computed from that day's
--    logs before the local-midnight reset wipes them). Nullable = "not logged".
alter table public.health_scores
  add column if not exists calories_in    integer,
  add column if not exists calories_out   integer,
  add column if not exists sleep_hours    numeric(4,1),
  add column if not exists water_glasses  integer,
  add column if not exists protein_g      integer,
  add column if not exists mood_score     numeric(3,1),   -- 0-10
  add column if not exists stress_level   numeric(3,1),   -- 1-10
  add column if not exists active_minutes integer,
  add column if not exists updated_at     timestamptz not null default now();

-- keep updated_at fresh on every upsert
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists trg_health_scores_touch on public.health_scores;
create trigger trg_health_scores_touch
  before update on public.health_scores
  for each row execute function public.touch_updated_at();

-- 3. ai_reports: cached LLM period summaries. One current row per
--    (user, period_type, period_end); regenerated when the period rolls or on
--    an explicit refresh.
create table if not exists public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_type   text not null check (period_type in ('week', 'month')),
  period_start  date not null,
  period_end    date not null,
  payload       jsonb not null,
  model         text,
  generated_at  timestamptz not null default now(),
  unique (user_id, period_type, period_end)
);
create index if not exists ai_reports_user_idx on public.ai_reports (user_id, period_type, period_end desc);

alter table public.ai_reports enable row level security;
revoke all on public.ai_reports from anon, authenticated;
grant select, insert, update, delete on public.ai_reports to authenticated;

drop policy if exists "ai_reports_own"       on public.ai_reports;
drop policy if exists "ai_reports_admin_all" on public.ai_reports;
create policy "ai_reports_own" on public.ai_reports
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
create policy "ai_reports_admin_all" on public.ai_reports
  for all to authenticated
  using ( (select public.is_admin()) )
  with check ( (select public.is_admin()) );
