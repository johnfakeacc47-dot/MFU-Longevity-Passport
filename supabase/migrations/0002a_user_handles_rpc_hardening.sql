-- Restored from the live project (supabase_migrations.schema_migrations,
-- version 20260907143948). Applied directly, never committed.

-- Pin search_path on the generator and make sure anon cannot reach the
-- handle-lookup RPCs (advisor 0011 / 0028).
alter function public.gen_user_handle() set search_path to 'public';

revoke execute on function public.find_profile_by_handle(text) from anon, public;
revoke execute on function public.add_team_member_by_handle(text) from anon, public;
grant execute on function public.find_profile_by_handle(text) to authenticated;
grant execute on function public.add_team_member_by_handle(text) to authenticated;
