-- ============================================================================
-- QA-008: "Adding a teammate should send a Pending request for the target to
-- approve, not add them instantly." — flagged as a privacy risk.
--
-- It's a bigger hole than just the RPC's UX: team_members_insert_own (see
-- 0001_enable_rls.sql) lets any authenticated user INSERT their own outgoing
-- edge directly via the client SDK, no RPC involved — and
-- profiles_select_teammates (0007) grants profile visibility the moment ANY
-- edge exists in either direction. So today, any signed-in user can grant
-- themselves read access to a stranger's profile row with a single client-side
-- insert, no lookup, no consent, nothing server-side to stop them.
--
-- Fix:
--   - team_requests: a pending/accepted/declined request log. Adding someone
--     now creates a pending row + notifies the target instead of touching
--     team_members at all.
--   - team_members rows are only ever created by respond_team_request() on
--     acceptance, mutually, in the same transaction as before (0006).
--   - team_members is locked down to SELECT-only for authenticated — no more
--     direct client insert, closing the hole above. Every write goes through
--     a SECURITY DEFINER RPC now.
--   - Crossed requests (A requests B while B's request to A is still
--     pending) auto-accept instead of leaving two dangling pending rows.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. team_requests
-- --------------------------------------------------------------------------
create table if not exists public.team_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  target_id     uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint team_requests_no_self check (requester_id <> target_id)
);

-- Only one *pending* request per direction at a time; a fresh one is fine
-- once the previous one is accepted/declined (re-request after a decline).
create unique index if not exists idx_team_requests_pending_pair
  on public.team_requests (requester_id, target_id) where status = 'pending';
create index if not exists idx_team_requests_target_pending
  on public.team_requests (target_id) where status = 'pending';

-- Locked down completely at the table level — every read and write goes
-- through the SECURITY DEFINER functions below, same as notify() in 0008.
alter table public.team_requests enable row level security;
revoke all on public.team_requests from anon, authenticated;

-- --------------------------------------------------------------------------
-- 2. team_members: close the direct-insert hole. SELECT stays (the client
--    reads its own roster for "My Team"); INSERT/UPDATE/DELETE go through
--    respond_team_request() (SECURITY DEFINER) only from now on. Nothing in
--    this app deletes a team_members row today, so dropping delete access
--    costs no feature.
-- --------------------------------------------------------------------------
drop policy if exists "team_members_insert_own" on public.team_members;
drop policy if exists "team_members_update_own" on public.team_members;
drop policy if exists "team_members_delete_own" on public.team_members;
revoke insert, update, delete on public.team_members from authenticated;

-- --------------------------------------------------------------------------
-- 3. request_team_member_by_handle() — replaces add_team_member_by_handle().
--    Creates a pending request and notifies the target instead of adding
--    them outright. If the target already has a pending request in to the
--    caller (a crossed request), resolves both as accepted immediately
--    instead of leaving two unresolved rows.
-- --------------------------------------------------------------------------
drop function if exists public.add_team_member_by_handle(text);

create or replace function public.request_team_member_by_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  target record;
  my_name text;
  my_lang text;
  target_lang text;
  crossed_id uuid;
  already_pending boolean;
  already_member boolean;
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

  select exists(
    select 1 from public.team_members
    where (user_id = me and member_id = target.id) or (user_id = target.id and member_id = me)
  ) into already_member;
  if already_member then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;

  select name, language into my_name, my_lang from public.profiles where id = me;
  select language into target_lang from public.profiles where id = target.id;

  -- Crossed request: target already asked to add ME. Treat my action as
  -- accepting theirs instead of filing a second, redundant pending row.
  select id into crossed_id
  from public.team_requests
  where requester_id = target.id and target_id = me and status = 'pending'
  limit 1;

  if crossed_id is not null then
    update public.team_requests set status = 'accepted', responded_at = now() where id = crossed_id;

    insert into public.team_members (user_id, member_id) values (me, target.id) on conflict do nothing;
    insert into public.team_members (user_id, member_id) values (target.id, me) on conflict do nothing;

    perform public.notify(
      target.id, 'team_request_accepted',
      case when target_lang = 'th' then 'มีคนตอบรับคำขอของคุณ!' else 'Your request was accepted!' end,
      case when target_lang = 'th'
        then coalesce(my_name, 'มีคน') || ' ตอบรับคำขอเป็นเพื่อนร่วมทีมของคุณแล้ว'
        else coalesce(my_name, 'Someone') || ' accepted your teammate request.'
      end,
      jsonb_build_object('teammateId', me)
    );

    return jsonb_build_object('ok', true, 'status', 'accepted', 'name', target.name, 'avatar_url', target.avatar_url);
  end if;

  select exists(
    select 1 from public.team_requests
    where requester_id = me and target_id = target.id and status = 'pending'
  ) into already_pending;
  if already_pending then
    return jsonb_build_object('ok', false, 'reason', 'already_requested');
  end if;

  insert into public.team_requests (requester_id, target_id) values (me, target.id);

  perform public.notify(
    target.id, 'team_request',
    case when target_lang = 'th' then 'คำขอเป็นเพื่อนร่วมทีม' else 'Teammate request' end,
    case when target_lang = 'th'
      then coalesce(my_name, 'มีคน') || ' ขอเพิ่มคุณเป็นเพื่อนร่วมทีม — แตะเพื่อดูคำขอ'
      else coalesce(my_name, 'Someone') || ' wants to add you as a teammate — tap to review.'
    end,
    jsonb_build_object('requesterId', me)
  );

  return jsonb_build_object('ok', true, 'status', 'pending', 'name', target.name, 'avatar_url', target.avatar_url);
end;
$$;
revoke all on function public.request_team_member_by_handle(text) from public, anon;
grant execute on function public.request_team_member_by_handle(text) to authenticated;

-- --------------------------------------------------------------------------
-- 4. respond_team_request() — the target accepts or declines. Only creates
--    team_members rows on acceptance, mutually, same as the old instant-add.
-- --------------------------------------------------------------------------
create or replace function public.respond_team_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  req record;
  my_name text;
  requester_lang text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select * into req from public.team_requests
  where id = p_request_id and target_id = me and status = 'pending'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.team_requests
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_request_id;

  if not p_accept then
    -- Declines stay quiet — no notification back to the requester.
    return jsonb_build_object('ok', true, 'accepted', false);
  end if;

  insert into public.team_members (user_id, member_id) values (me, req.requester_id) on conflict do nothing;
  insert into public.team_members (user_id, member_id) values (req.requester_id, me) on conflict do nothing;

  select name into my_name from public.profiles where id = me;
  select language into requester_lang from public.profiles where id = req.requester_id;

  perform public.notify(
    req.requester_id, 'team_request_accepted',
    case when requester_lang = 'th' then 'มีคนตอบรับคำขอของคุณ!' else 'Your request was accepted!' end,
    case when requester_lang = 'th'
      then coalesce(my_name, 'มีคน') || ' ตอบรับคำขอเป็นเพื่อนร่วมทีมของคุณแล้ว'
      else coalesce(my_name, 'Someone') || ' accepted your teammate request.'
    end,
    jsonb_build_object('teammateId', me)
  );

  return jsonb_build_object('ok', true, 'accepted', true);
end;
$$;
revoke all on function public.respond_team_request(uuid, boolean) from public, anon;
grant execute on function public.respond_team_request(uuid, boolean) to authenticated;

-- --------------------------------------------------------------------------
-- 5. list_pending_team_requests() — incoming requests for the "Pending"
--    section on the Team page. SECURITY DEFINER because the requester isn't
--    a teammate yet (that's the point), so plain profiles RLS wouldn't let
--    the target see their name/avatar otherwise; exposes the same minimal
--    fields find_profile_by_handle already does.
-- --------------------------------------------------------------------------
create or replace function public.list_pending_team_requests()
returns table (
  request_id uuid,
  requester_id uuid,
  requester_name text,
  requester_avatar_url text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select tr.id, tr.requester_id, p.name, p.avatar_url, tr.created_at
  from public.team_requests tr
  join public.profiles p on p.id = tr.requester_id
  where tr.target_id = auth.uid() and tr.status = 'pending'
  order by tr.created_at desc;
$$;
revoke all on function public.list_pending_team_requests() from public, anon;
grant execute on function public.list_pending_team_requests() to authenticated;

-- --------------------------------------------------------------------------
-- 6. notify() preference gating for the two new types — same team_notifs
--    toggle teammate_added already used (the "else true" fallback already
--    covered this, but spelling it out matches the rest of the CASE).
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
    when 'teammate_added'        then coalesce(np.team_notifs, true)
    when 'team_request'          then coalesce(np.team_notifs, true)
    when 'team_request_accepted' then coalesce(np.team_notifs, true)
    when 'challenge_complete'    then coalesce(np.challenge_notifs, true)
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
