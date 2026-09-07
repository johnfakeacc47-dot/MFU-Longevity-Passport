-- 0002_user_handles.sql
-- Short, shareable per-user handles ("swift-lotus-73") so teammates can be added
-- by QR code or manual entry instead of email. Lookup + insert run through
-- SECURITY DEFINER RPCs because RLS on `profiles` otherwise hides every user
-- whose score is private (which is all of them by default) — the same wall that
-- broke inviteTeamMemberByEmail (see supabase/RLS_ROLLOUT.md).

-- 1. handle column --------------------------------------------------------------
alter table public.profiles add column if not exists handle text;

-- 2. generator: adjective-noun-NN, retried until unique -----------------------
create or replace function public.gen_user_handle()
returns text
language plpgsql
set search_path to 'public'
as $$
declare
  adjectives text[] := array[
    'brave','calm','swift','bright','bold','keen','kind','wise','lucky','noble',
    'merry','proud','quick','sunny','witty','zesty','agile','clever','gentle','jolly',
    'lively','plucky','snappy','spry','vivid','warm','eager','fair','fresh','glad'];
  nouns text[] := array[
    'otter','lotus','tiger','panda','koala','falcon','maple','cedar','comet','river',
    'ember','pixel','mango','pepper','willow','sparrow','dolphin','badger','cactus','orchid',
    'walnut','pebble','meadow','harbor','canyon','breeze','gecko','heron','lark','moose'];
  candidate text;
  tries int := 0;
begin
  loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
              || '-' || nouns[1 + floor(random() * array_length(nouns, 1))::int]
              || '-' || lpad(floor(random() * 100)::text, 2, '0');
    exit when not exists (select 1 from public.profiles where handle = candidate);
    tries := tries + 1;
    if tries > 50 then
      candidate := candidate || '-' || substr(md5(random()::text), 1, 4);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

-- 3. backfill existing rows ---------------------------------------------------
update public.profiles set handle = public.gen_user_handle() where handle is null;

-- 4. lock it down: not null + unique ----------------------------------------
alter table public.profiles alter column handle set not null;
alter table public.profiles add constraint profiles_handle_key unique (handle);

-- 5. assign a handle on signup (extends the existing trigger fn) ------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, name, role, total_points, handle)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'student',
    0,
    public.gen_user_handle()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 6. read-only preview lookup (name + avatar only) -------------------------
create or replace function public.find_profile_by_handle(p_handle text)
returns table (id uuid, name text, avatar_url text)
language sql
security definer
set search_path to 'public'
as $$
  select p.id, p.name, p.avatar_url
  from public.profiles p
  where p.handle = lower(trim(p_handle))
  limit 1;
$$;

-- 7. resolve handle + add caller's team_members row in one shot -----------
create or replace function public.add_team_member_by_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  target record;
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

  return jsonb_build_object('ok', true, 'name', target.name, 'avatar_url', target.avatar_url);
end;
$$;

-- 8. grants: authenticated only, never anon --------------------------------
revoke all on function public.gen_user_handle() from public, anon;
revoke all on function public.find_profile_by_handle(text) from public, anon;
revoke all on function public.add_team_member_by_handle(text) from public, anon;
grant execute on function public.gen_user_handle() to authenticated;
grant execute on function public.find_profile_by_handle(text) to authenticated;
grant execute on function public.add_team_member_by_handle(text) to authenticated;
