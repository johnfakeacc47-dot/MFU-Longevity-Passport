-- ============================================================================
-- Grant hygiene: trim table privileges to what the client actually uses, stop
-- new tables from inheriting ALL, and lock down trigger-only functions.
--
-- Everything below was checked against the live database first
-- (information_schema.table_privileges / column_privileges / pg_proc).
--
-- 1. chat_messages and daily_logs were created without an explicit grant
--    list, so they picked up Supabase's default privileges for the schema:
--    ALL — including TRUNCATE, REFERENCES and TRIGGER — for authenticated.
--    RLS still scopes rows to the owner, but TRUNCATE is not subject to RLS
--    (any logged-in user could wipe every user's chat history or daily logs
--    with one PostgREST call), and REFERENCES/TRIGGER have no business being
--    reachable from a JWT. The client only ever does:
--      chat_messages  select / insert / delete   (src/services/healthChatApi.ts)
--      daily_logs     select / insert / update / delete (upsert needs UPDATE)
--    so that is exactly what stays.
--
-- 2. The schema-level default is the reason those two slipped through, and
--    it will keep happening to every future table unless the default itself
--    changes. After this, a new table has NO client access until a migration
--    grants it explicitly (which is what 0008, 0013, 0015 and 0016 already
--    do by hand for their tables). service_role keeps its defaults — the
--    Edge Functions rely on it.
--
-- 3. profiles.email is the login identity's mirror (handle_new_user copies it
--    from auth.users on signup; admin-users keeps it in sync via the service
--    role). authenticated had a column-level UPDATE on it, so any user could
--    rewrite their own displayed email to anything — including someone
--    else's — and that string is what the admin user list used to show.
--    Column-level INSERT stays: the Login signup fallback
--    (src/pages/Login.tsx, `.from('profiles').upsert({ id, email, name })`)
--    sets email on the INSERT path, which is still allowed. No client code
--    sends `email` in a profiles UPDATE (checked: updateCurrentUserProfile's
--    column map in src/services/supabaseClient.ts does not include it).
--
-- 4. touch_updated_at / touch_daily_logs_updated_at / gen_user_handle exist
--    live (pg_proc) and are trigger-/internal-only:
--      touch_updated_at              <- trg_health_scores_touch
--      touch_daily_logs_updated_at   <- trg_daily_logs_touch
--      gen_user_handle               <- called only inside handle_new_user()
--                                       (SECURITY DEFINER, runs as owner) and
--                                       the one-off backfill in 0002
--    Trigger firing does not need EXECUTE for the DML role (same reasoning as
--    0009), and nothing in src/ calls gen_user_handle via rpc. Yet all three
--    were callable at /rest/v1/rpc/... — touch_* by anon as well. Also
--    touch_updated_at had no search_path pinned (the other two already did),
--    which the Supabase advisor flags for any function a trigger runs.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Exact grants on the two tables that had ALL.
-- --------------------------------------------------------------------------
revoke all on public.chat_messages, public.daily_logs from authenticated;
grant select, insert, delete          on public.chat_messages to authenticated;
grant select, insert, update, delete  on public.daily_logs    to authenticated;

-- --------------------------------------------------------------------------
-- 2. Future tables: no implicit client grants.
--    Applies to tables created by the role running this migration (postgres
--    via the CLI / dashboard / MCP), which is the role every migration here
--    runs as.
-- --------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- --------------------------------------------------------------------------
-- 3. Email is not user-editable.
-- --------------------------------------------------------------------------
revoke update (email) on public.profiles from authenticated;

-- --------------------------------------------------------------------------
-- 4. Trigger-only functions: not callable from the API, search_path pinned.
-- --------------------------------------------------------------------------
alter function public.touch_updated_at() set search_path = public;

revoke all on function public.touch_updated_at()            from public, anon, authenticated;
revoke all on function public.touch_daily_logs_updated_at() from public, anon, authenticated;
revoke all on function public.gen_user_handle()             from public, anon, authenticated;
