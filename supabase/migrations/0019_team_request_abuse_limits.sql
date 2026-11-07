-- ============================================================================
-- Abuse limits on the two handle RPCs anyone logged in can call.
--
-- Both functions are re-created from their LIVE definitions
-- (pg_get_functiondef, fetched while writing this), not from 0002/0013: the
-- live versions were last replaced by a `user_handles_rpc_hardening`
-- migration that has no file in this repo. Signatures, SECURITY DEFINER,
-- search_path, the auth.uid() checks and every existing return shape are
-- kept exactly; only the new checks are added.
--
-- 1. request_team_member_by_handle(text)
--    - A declined request could be re-filed immediately: respond_team_request
--      (0013) marks the row 'declined' with responded_at, the pending-only
--      uniqueness check no longer sees it, and the target gets a fresh
--      notification. Decline -> new request -> decline, forever. Now a decline
--      from a given target blocks a new request to them for 7 days
--      (reason 'recently_declined').
--    - Nothing capped how many requests one account could file; combined with
--      a handle lookup that is also unlimited (below) that is a notification
--      spam tool aimed at the whole user base. Now at most 20 requests per
--      rolling 24 h per requester (reason 'rate_limited').
--    Both checks sit AFTER the crossed-request branch on purpose: if the
--    target has already asked to add me, my action is accepting theirs, not
--    filing a request, so neither limit should get in the way.
--    team_requests columns checked live: id, requester_id, target_id, status,
--    created_at, responded_at.
--
-- 2. find_profile_by_handle(text)
--    Handles are 'word-word-NN' (gen_user_handle, 0002) — a small space that
--    an unlimited lookup lets anyone enumerate for every name + avatar in the
--    system. Now capped at 60 lookups per caller per Bangkok day, reusing
--    public.ai_usage / consume_ai_quota from 0017 (kind 'handle_lookup')
--    rather than adding a second counter table of the same shape. Over the
--    cap it raises with SQLSTATE 'PT429', which PostgREST turns into an HTTP
--    429, and the client's previewHandle() already maps any RPC error to
--    { kind: 'error' } ("try again") instead of blaming the code typed.
--    Switched from `language sql` to plpgsql for the if/raise; same
--    signature, same RETURNS TABLE, same grants (re-stated below).
--
-- Client note (src/services/teamInvite.ts / TeamInvite.tsx): the two new
-- reasons are not in the InviteReason union yet. They fall through to the
-- generic error message today (reasonKey()'s default branch), so nothing
-- breaks; adding dedicated strings is a UI follow-up.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. request_team_member_by_handle — decline cooldown + daily cap.
-- --------------------------------------------------------------------------
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
  recently_declined boolean;
  recent_requests int;
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

  -- NEW: they said no less than a week ago — do not let me ask again yet.
  select exists(
    select 1 from public.team_requests
    where requester_id = me and target_id = target.id
      and status = 'declined'
      and responded_at > now() - interval '7 days'
  ) into recently_declined;
  if recently_declined then
    return jsonb_build_object('ok', false, 'reason', 'recently_declined');
  end if;

  -- NEW: at most 20 requests filed per rolling 24 h, whatever their outcome.
  select count(*) into recent_requests
  from public.team_requests
  where requester_id = me and created_at > now() - interval '24 hours';
  if recent_requests >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
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
-- 2. find_profile_by_handle — 60 lookups per caller per day.
-- --------------------------------------------------------------------------
create or replace function public.find_profile_by_handle(p_handle text)
returns table (id uuid, name text, avatar_url text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
begin
  -- The function is granted to authenticated only, so this is belt-and-braces;
  -- an anonymous caller gets an empty result, never a lookup.
  if me is null then
    return;
  end if;

  -- SECURITY DEFINER runs as the owner, which is why this may call the
  -- service_role-only consume_ai_quota() on the caller's behalf.
  if not public.consume_ai_quota(me, 'handle_lookup', 60) then
    raise sqlstate 'PT429' using
      message = 'rate_limited',
      detail  = 'Too many handle lookups today — try again tomorrow.';
  end if;

  return query
    select p.id, p.name, p.avatar_url
    from public.profiles p
    where p.handle = lower(trim(p_handle))
    limit 1;
end;
$$;

revoke all on function public.find_profile_by_handle(text) from public, anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;
