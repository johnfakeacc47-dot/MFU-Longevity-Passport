-- ============================================================================
-- Achievement badges (src/utils/healthCoach.ts getAchievements()) are computed
-- entirely client-side from local logs, recomputed fresh on every render, with
-- no persisted "was this already unlocked" state anywhere — so nothing ever
-- detected the moment a badge crossed its threshold, and there was no
-- notification or popup for it. The transition-detection itself has to live
-- client-side (that's where the source data is), but firing the actual
-- notification needs a DB round trip so it lands in the bell + triggers push
-- like every other notification type.
--
-- public.notify() is locked to service_role only (0008) — a plain
-- authenticated user can't call it directly, by design. notify_badge_unlocked
-- is the narrow exception: it can ONLY notify the CALLER about THEMSELVES
-- (hardcoded to auth.uid(), never a parameter), and only for a badge id from
-- the fixed set below — not a generic "notify anyone anything" RPC.
-- ============================================================================

alter table public.notification_preferences
  add column if not exists badge_notifs boolean not null default true;

create or replace function public.notify_badge_unlocked(p_badge_id text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  lang text;
  badge_title text;
begin
  if me is null then
    return null;
  end if;

  select language into lang from public.profiles where id = me;

  -- Mirrors the id -> titleKey mapping in getAchievements(); kept as its own
  -- bilingual copy here rather than trusting client-supplied text, same as
  -- every other notify() call site in this project.
  badge_title := case p_badge_id
    when 'log7d'    then case when lang = 'th' then 'นักบันทึกสม่ำเสมอ 7 วัน' else '7-Day Consistent Logger' end
    when 'ex100m'   then case when lang = 'th' then 'นักเคลื่อนไหว 100 นาที' else '100-Minute Active Mover' end
    when 'sleep10d' then case when lang = 'th' then 'เชี่ยวชาญการนอน 10 วัน' else '10-Day Sleep Master' end
    when 'cal7d'    then case when lang = 'th' then 'ผู้เชี่ยวชาญโภชนาการ 7 วัน' else '7-Day Nutrition Expert' end
    else null
  end;

  if badge_title is null then
    return null; -- unknown id — refuse rather than notify with a raw id string
  end if;

  return public.notify(
    me, 'badge_unlocked',
    case when lang = 'th' then '🏆 ปลดล็อคตราสัญลักษณ์ใหม่!' else '🏆 New badge unlocked!' end,
    badge_title,
    jsonb_build_object('badgeId', p_badge_id)
  );
end;
$$;
revoke all on function public.notify_badge_unlocked(text) from public, anon;
grant execute on function public.notify_badge_unlocked(text) to authenticated;

-- notify()'s preference gate: add badge_unlocked explicitly (the "else true"
-- fallback already covered it, but every other type is spelled out).
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
    when 'teammate_added'        then coalesce(np.team_notifs, true)
    when 'team_request'          then coalesce(np.team_notifs, true)
    when 'team_request_accepted' then coalesce(np.team_notifs, true)
    when 'challenge_complete'    then coalesce(np.challenge_notifs, true)
    when 'badge_unlocked'        then coalesce(np.badge_notifs, true)
    when 'reminder_meal'         then coalesce(np.meal_reminder, true)
    when 'reminder_water'        then coalesce(np.water_reminder, true)
    when 'reminder_sleep'        then coalesce(np.sleep_reminder, true)
    when 'reminder_activity'     then coalesce(np.activity_reminder, true)
    when 'reminder_fasting'      then coalesce(np.fasting_reminder, true)
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
