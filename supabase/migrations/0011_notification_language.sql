-- ============================================================================
-- QA-001: notifications showed English text even in the Thai UI.
--
-- Root cause: the server-side notification generators (teammate-added,
-- challenge-complete, the scheduled reminders) had no idea what language a
-- user reads in -- profiles never stored it, only localStorage did (see
-- LanguageContext.tsx), which the database obviously can't see. So every
-- notify() call used hardcoded English title/body text unconditionally.
--
-- Fix: profiles.language, synced from the client whenever the user changes
-- it (see src/contexts/LanguageContext.tsx), and every notify() call site
-- now picks English or Thai text based on the target user's saved language.
-- ============================================================================

alter table public.profiles
  add column if not exists language text not null default 'th'
    check (language in ('en', 'th'));

grant update (language) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Teammate added
-- ---------------------------------------------------------------------------
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
  target_lang text;
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

  select name, language into my_name, target_lang from public.profiles where id = me;
  select language into target_lang from public.profiles where id = target.id;

  perform public.notify(
    target.id, 'teammate_added',
    case when target_lang = 'th' then 'เพื่อนร่วมทีมใหม่!' else 'New teammate!' end,
    case when target_lang = 'th'
      then coalesce(my_name, 'มีคน') || ' เพิ่มคุณเป็นเพื่อนร่วมทีม'
      else coalesce(my_name, 'Someone') || ' added you as a teammate.'
    end,
    jsonb_build_object('teammateId', me)
  );

  return jsonb_build_object('ok', true, 'name', target.name, 'avatar_url', target.avatar_url);
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly challenge complete
-- ---------------------------------------------------------------------------
create or replace function public.check_team_challenge(p_user_id uuid) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  team_total integer;
  already_notified boolean;
  target_lang text;
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

  select language into target_lang from public.profiles where id = p_user_id;

  perform public.notify(
    p_user_id, 'challenge_complete',
    case when target_lang = 'th' then 'ชาเลนจ์รายสัปดาห์สำเร็จ!' else 'Weekly challenge complete!' end,
    case when target_lang = 'th'
      then 'ทีมของคุณทำคะแนนรวม 500 แต้มสำเร็จในสัปดาห์นี้ เยี่ยมมาก'
      else 'Your team just hit the 500-point goal for this week. Great work.'
    end,
    jsonb_build_object('teamTotal', team_total)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled reminders (eat / water / sleep / activity / fasting)
-- ---------------------------------------------------------------------------
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
  if bkk_time between '07:55' and '08:10'
     or bkk_time between '12:25' and '12:40'
     or bkk_time between '18:25' and '18:40' then
    for r in
      select p.id, p.language from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.nutrition, 0) = 0
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_meal' and n.created_at::date = bkk_date
        )
    loop
      if public.notify(r.id, 'reminder_meal',
        case when r.language = 'th' then 'ถึงเวลากินข้าว' else 'Time to eat' end,
        case when r.language = 'th' then 'วันนี้คุณยังไม่ได้บันทึกมื้ออาหาร — บันทึกสักหน่อยช่วยเพิ่มคะแนนได้' else 'You haven''t logged a meal yet today — a quick log helps your score.' end
      ) is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  if bkk_time between '08:55' and '09:10' or bkk_time between '10:55' and '11:10'
     or bkk_time between '12:55' and '13:10' or bkk_time between '14:55' and '15:10'
     or bkk_time between '16:55' and '17:10' or bkk_time between '18:55' and '19:10'
     or bkk_time between '20:55' and '21:10' then
    for r in
      select p.id, p.language from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.water_glasses, 0) < 8
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_water' and n.created_at > bkk_now - interval '90 minutes'
        )
    loop
      if public.notify(r.id, 'reminder_water',
        case when r.language = 'th' then 'อย่าลืมดื่มน้ำ' else 'Stay hydrated' end,
        case when r.language = 'th' then 'ดื่มน้ำสักแก้วตอนนี้ ช่วยให้ถึงเป้าหมายของวันนี้' else 'A glass of water now keeps you on track for today''s goal.' end
      ) is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  if bkk_time between '21:25' and '21:40' then
    for r in
      select p.id, p.language from public.profiles p
      where not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'reminder_sleep' and n.created_at::date = bkk_date
      )
    loop
      if public.notify(r.id, 'reminder_sleep',
        case when r.language = 'th' then 'ใกล้เวลานอนแล้ว' else 'Wind down soon' end,
        case when r.language = 'th' then 'นอนหลับให้เพียงพอคืนนี้ ช่วยให้คะแนนพรุ่งนี้ดีขึ้น' else 'Good sleep tonight means a better score tomorrow.' end
      ) is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  if bkk_time between '16:55' and '17:10' then
    for r in
      select p.id, p.language from public.profiles p
      left join public.health_scores hs on hs.user_id = p.id and hs.date = bkk_date
      where coalesce(hs.active_minutes, 0) = 0
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'reminder_activity' and n.created_at::date = bkk_date
        )
    loop
      if public.notify(r.id, 'reminder_activity',
        case when r.language = 'th' then 'ลองขยับร่างกายวันนี้' else 'Move a little today' end,
        case when r.language = 'th' then 'วันนี้ยังไม่มีการออกกำลังกาย แม้แต่เดินเล่นสั้นๆ ก็นับ' else 'No activity logged yet — even a short walk counts.' end
      ) is not null then
        sent := sent + 1;
      end if;
    end loop;
  end if;

  for r in
    select p.id, p.language from public.profiles p
    where p.fasting_start_time is not null
      and p.fasting_target_hours is not null
      and p.fasting_start_time + (p.fasting_target_hours || ' hours')::interval <= now()
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'reminder_fasting' and n.created_at >= p.fasting_start_time
      )
  loop
    if public.notify(r.id, 'reminder_fasting',
      case when r.language = 'th' then 'ถึงเป้าหมายการอดอาหารแล้ว!' else 'Fasting goal reached!' end,
      case when r.language = 'th' then 'เยี่ยมมาก ถึงเวลาบันทึกมื้อแรกของคุณ' else 'Great work — time to log your first meal.' end
    ) is not null then
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end;
$$;
