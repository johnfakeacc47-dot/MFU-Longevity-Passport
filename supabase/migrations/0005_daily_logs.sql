-- 0005_daily_logs.sql
-- Cross-device sync for the raw daily logs (meals / activities / sleep / mental /
-- water). Until now only the health_scores rollup and the profile synced, so two
-- devices on the same account showed different histories (QA-009).
--
-- One jsonb blob per user per Bangkok-local day. The client pushes "today" on a
-- debounce and pulls the last ~2 weeks on boot; conflict resolution is
-- last-write-wins by `updated_at` for today and gap-fill for past days.

create table if not exists public.daily_logs (
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  logs       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, date desc);

alter table public.daily_logs enable row level security;

create policy daily_logs_own on public.daily_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy daily_logs_admin_read on public.daily_logs
  for select using (public.is_admin());

revoke all on public.daily_logs from anon, public;
grant select, insert, update, delete on public.daily_logs to authenticated;

-- keep updated_at fresh on every write
create or replace function public.touch_daily_logs_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_daily_logs_touch on public.daily_logs;
create trigger trg_daily_logs_touch before update on public.daily_logs
  for each row execute function public.touch_daily_logs_updated_at();
