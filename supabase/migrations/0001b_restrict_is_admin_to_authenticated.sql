-- Restored from the live project (supabase_migrations.schema_migrations,
-- version 20260907102513). Applied directly, never committed.

-- is_admin() is only referenced by RLS policies scoped `to authenticated`.
-- anon never evaluates those, so it has no need to execute the function.
revoke execute on function public.is_admin() from anon;
