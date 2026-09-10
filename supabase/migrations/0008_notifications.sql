-- ============================================================================
-- Full notification system: in-app notification log, Web Push delivery,
-- per-user preferences, and the server-side triggers/schedule that generate
-- notifications automatically (teammate added, weekly challenge complete,
-- eat/drink/sleep/move reminders, fasting-goal-reached).
--
-- Architecture:
--   notifications         -- the single source of truth / in-app log. Always
--                             works even with push permission denied.
--   push_subscriptions    -- Web Push endpoints (one row per browser/device).
--   notification_preferences -- per-user on/off toggles per notification type.
--   public.notify(...)    -- the one function everything else calls to create
--                             a notification; checks the relevant preference
--                             toggle first.
--   trg_push_on_notification -- AFTER INSERT on notifications -> pg_net POSTs
--                             to the send-push Edge Function, which delivers
--                             a real Web Push to every subscribed device.
--   trg_check_team_challenge -- AFTER UPDATE OF total_points on profiles ->
--                             re-checks the 500-pt weekly team challenge for
--                             every roster this profile belongs to.
--   run_scheduled_reminders() -- called every 30 min by pg_cron (via
--                             trigger_send_reminders() -> send-reminders Edge
--                             Function) to fire eat/water/sleep/activity/
--                             fasting reminders.
--
-- Secrets: the trigger and cron functions authenticate their outbound calls
-- to the Edge Functions with a shared secret read from Supabase Vault
-- (vault.decrypted_secrets, name 'notify_internal_secret') -- NOT hardcoded
-- here. That secret still needs to be created once, live, out of band:
--   select vault.create_secret('<the-secret-value>', 'notify_internal_secret');
-- and the same value added as the NOTIFY_INTERNAL_SECRET Edge Function
-- secret, alongside VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
-- Until that secret exists, the trigger/cron functions no-op gracefully (the
-- in-app notification still gets recorded either way -- only the push
-- delivery step is skipped).
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  meal_reminder     boolean not null default true,
  water_reminder    boolean not null default true,
  sleep_reminder    boolean not null default true,
  activity_reminder boolean not null default true,
  fasting_reminder  boolean not null default true,
  team_notifs       boolean not null default true,
  challenge_notifs  boolean not null default true,
  updated_at        timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread   on public.notifications (user_id) where not read;

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

-- --------------------------------------------------------------------------
-- 2. RLS -- same shape as every other per-user table in this project
--    (0001_enable_rls.sql): anon gets nothing, authenticated gets their own
--    rows only, service_role (Edge Functions) is untouched.
-- --------------------------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.notifications             enable row level security;
alter table public.push_subscriptions        enable row level security;

revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.notifications             from anon, authenticated;
revoke all on public.push_subscriptions        from anon, authenticated;

grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

drop policy if exists "notification_preferences_own" on public.notification_preferences;
create policy "notification_preferences_own" on public.notification_preferences
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- --------------------------------------------------------------------------
-- 3. notify() -- the single entry point for creating a notification.
--    Locked down to service_role + internal SECURITY DEFINER callers only --
--    an ordinary authenticated user must never be able to notify someone
--    else directly.
-- --------------------------------------------------------------------------

create or replace function public.notify(
  p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  allowed boolean;
  new_id uuid;
begin
  select case p_type
    when 'teammate_added'     then coalesce(np.team_notifs, true)
    when 'challenge_complete' then coalesce(np.challenge_notifs, true)
    when 'reminder_meal'      then coalesce(np.meal_reminder, true)
    when 'reminder_water'     then coalesce(np.water_reminder, true)
    when 'reminder_sleep'     then coalesce(np.sleep_reminder, true)
    when 'reminder_activity'  then coalesce(np.activity_reminder, true)
    when 'reminder_fasting'   then coalesce(np.fasting_reminder, true)
    else true
  end into allowed
  from (select 1) x
  left join public.notification_preferences np on np.user_id = p_user_id;

  if not coalesce(allowed, true) then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, jsonb) to service_role;

-- --------------------------------------------------------------------------
-- 4. Teammate-added notification -- hooks into the existing mutual-add RPC
--    from 0006_mutual_team_members.sql. Only the person being added gets
--    notified (the adder already sees an inline success state in the UI).
-- --------------------------------------------------------------------------

create or replace function public.add_team_member_by_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  target record;
  my_name text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select id, name, avatar_url into target
  from public.profiles
  where handle = lower(trim(p_handle))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if target.id = me then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  begin
    insert into public.team_members (user_id, member_id) values (me, target.id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end;

  insert into public.team_members (user_id, member_id) values (target.id, me)
  on conflict (user_id, member_id) do nothing;

  select name into my_name from public.profiles where id = me;
  perform public.notify(
    target.id, 'teammate_added', 'New teammate!',
    coalesce(my_name, 'Someone') || ' added you as a teammate.',
    jsonb_build_object('teammateId', me)
  );

  return jsonb_build_object('ok', true, 'name', target.name, 'avatar_url', target.avatar_url);
end;
$$;

-- --------------------------------------------------------------------------
-- 5. Weekly team-challenge-complete notification. "Team" here is a user's
--    own mutual roster (self + team_members), same total the Team page's
--    7-Day Wellness Challenge already sums client-side. Re-checked whenever
--    any profile in a roster changes total_points; deduped to once per ISO
--    week per user.
-- --------------------------------------------------------------------------

create or replace function public.check_team_challenge(p_user_id uuid) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  team_total integer;
  already_notified boolean;
begin
  select coalesce(sum(pr.total_points), 0) into team_total
  from public.profiles pr
  where pr.id = p_user_id
     or pr.id in (select tm.member_id from public.team_members tm where tm.user_id = p_user_id);

  if team_total < 500 then
    return;
  end if;

  select exists(
    select 1 from public.notifications
    where user_id = p_user_id and type = 'challenge_complete'
      and created_at >= date_trunc('week', now())
  ) into already_notified;

  if already_notified then
    return;
  end if;

  perform public.notify(
    p_user_id, 'challenge_complete', 'Weekly challenge complete!',
    'Your team just hit the 500-point goal for this week. Great work.',
    jsonb_build_object('teamTotal', team_total)
  );
end;
$$;
revoke all on function public.check_team_challenge(uuid) from public, anon, authenticated;
grant execute on function public.check_team_challenge(uuid) to service_role;

create or replace function public.trigger_check_team_challenge() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  if new.total_points is distinct from old.total_points then
    perform public.check_team_challenge(new.id);
    for r in select tm.user_id from public.team_members tm where tm.member_id = new.id loop
      perform public.check_team_challenge(r.user_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_team_challenge on public.profiles;
create trigger trg_check_team_challenge
  after update of total_points on public.profiles
  for each row execute function public.trigger_check_team_challenge();

-- --------------------------------------------------------------------------
-- 6. Push delivery bridge -- every notifications insert fires a Web Push via
--    the send-push Edge Function. Fails silently (in-app row still exists)
--    if the Vault secret isn't configured yet or the HTTP call errors.
-- --------------------------------------------------------------------------

create or replace function public.trigger_push_on_notification() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_internal_secret' limit 1;
  if secret is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://fqcouucedkxgocktbcre.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
      body := jsonb_build_object(
        'user_id', new.user_id, 'title', new.title, 'body', new.body,
        'data', new.data, 'notification_id', new.id
      )
    );
  exception when others then
    null; -- never let a push-delivery failure roll back the notification itself
  end;

  return new;
end;
$$;

drop trigger if exists trg_push_on_notification on public.notifications;
create trigger trg_push_on_notification
  after insert on public.notifications
  for each row execute function public.trigger_push_on_notification();

-- --------------------------------------------------------------------------
-- 7. Scheduled reminders -- eat / water / sleep / move / fasting-complete.
--    Bangkok local time throughout (this project never uses UTC day
--    boundaries for anything user-facing -- see src/utils/bangkokTime.ts).
--    Windows are sized to the 30-minute cron interval below so each one
--    fires exactly once per occurrence.
-- --------------------------------------------------------------------------

create or replace function public.run_scheduled_reminders() returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  bkk_now  timestamp := (now() at time zone 'Asia/Bangkok');
  bkk_time time := bkk_now::time;
  bkk_date date := bkk_now::date;
  sent integer := 0;
  r record;
begin
  -- Meals: 08:00, 12:30, 18:30
  if bkk_time between '07:55' and '08:10'
     or bkk_time between '12:25' and '12:40'
     or bkk_time between '18:25' and '18:40' then
    for r in
      select p.id from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.nutrition, 0) = 0
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_meal' and n.created_at::date = bkk_date
        )
    loop
      if public.notify(r.id, 'reminder_meal', 'Time to eat', 'You haven''t logged a meal yet today — a quick log helps your score.') is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  -- Water: every 2h, 09:00-21:00
  if bkk_time between '08:55' and '09:10' or bkk_time between '10:55' and '11:10'
     or bkk_time between '12:55' and '13:10' or bkk_time between '14:55' and '15:10'
     or bkk_time between '16:55' and '17:10' or bkk_time between '18:55' and '19:10'
     or bkk_time between '20:55' and '21:10' then
    for r in
      select p.id from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.water_glasses, 0) < 8
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_water' and n.created_at > bkk_now - interval '90 minutes'
        )
    loop
      if public.notify(r.id, 'reminder_water', 'Stay hydrated', 'A glass of water now keeps you on track for today''s goal.') is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  -- Sleep wind-down: 21:30
  if bkk_time between '21:25' and '21:40' then
    for r in
      select p.id from public.profiles p
      where not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'reminder_sleep' and n.created_at::date = bkk_date
      )
    loop
      if public.notify(r.id, 'reminder_sleep', 'Wind down soon', 'Good sleep tonight means a better score tomorrow.') is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  -- Activity nudge: 17:00
  if bkk_time between '16:55' and '17:10' then
    for r in
      select p.id from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.active_minutes, 0) = 0
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_activity' and n.created_at::date = bkk_date
        )
    loop
      if public.notify(r.id, 'reminder_activity', 'Move a little today', 'No activity logged yet — even a short walk counts.') is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  -- Fasting goal reached -- checked every run since it's per-user timing,
  -- not a fixed clock window.
  for r in
    select p.id from public.profiles p
    where p.fasting_start_time is not null
      and p.fasting_target_hours is not null
      and p.fasting_start_time + (p.fasting_target_hours || ' hours')::interval <= now()
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'reminder_fasting' and n.created_at >= p.fasting_start_time
      )
  loop
    if public.notify(r.id, 'reminder_fasting', 'Fasting goal reached!', 'Great work — time to log your first meal.') is not null then
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end;
$$;
revoke all on function public.run_scheduled_reminders() from public, anon, authenticated;
grant execute on function public.run_scheduled_reminders() to service_role;

create or replace function public.trigger_send_reminders() returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_internal_secret' limit 1;
  if secret is null then
    return;
  end if;

  begin
    perform net.http_post(
      url := 'https://fqcouucedkxgocktbcre.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
      body := '{}'::jsonb
    );
  exception when others then
    null;
  end;
end;
$$;

select cron.schedule('send-reminders-every-30-min', '*/30 * * * *', $$select public.trigger_send_reminders();$$);
