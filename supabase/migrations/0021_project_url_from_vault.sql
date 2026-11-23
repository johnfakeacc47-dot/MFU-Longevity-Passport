-- ============================================================================
-- Notification triggers: read the project URL from Vault instead of a
-- hard-coded address.
--
-- trigger_push_on_notification() and trigger_send_reminders() (0008) called
-- https://fqcouucedkxgocktbcre.supabase.co/functions/v1/... literally. That
-- is fine for this one project, but the app is being handed over to MFU on a
-- new Supabase project (see HANDOVER.md): copied as-is, MFU's database would
-- keep sending every push notification and reminder to the old project's
-- Edge Functions, where the shared secret doesn't match — so nothing would be
-- delivered, silently.
--
-- The base URL now comes from a Vault secret named 'project_url', the same
-- way the shared secret already comes from 'notify_internal_secret'. Each
-- project sets its own, once:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--
-- If either secret is missing the trigger no-ops exactly as before (the in-app
-- notification is still recorded; only the push/reminder call is skipped).
--
-- Also raises pg_net's timeout from its 5 s default: the Edge Function calls
-- were regularly logged as "Timeout of 5000 ms reached" (DNS alone sometimes
-- took ~6 s) even though the function received and completed the request.
-- ============================================================================

create or replace function public.trigger_push_on_notification() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret   text;
  base_url text;
begin
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'notify_internal_secret' limit 1;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url'            limit 1;
  if secret is null or base_url is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := rtrim(base_url, '/') || '/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
      body := jsonb_build_object(
        'user_id', new.user_id, 'title', new.title, 'body', new.body,
        'data', new.data, 'notification_id', new.id
      ),
      timeout_milliseconds := 15000
    );
  exception when others then
    null; -- never let a push-delivery failure roll back the notification itself
  end;

  return new;
end;
$$;

create or replace function public.trigger_send_reminders() returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret   text;
  base_url text;
begin
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'notify_internal_secret' limit 1;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url'            limit 1;
  if secret is null or base_url is null then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(base_url, '/') || '/functions/v1/send-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  exception when others then
    null;
  end;
end;
$$;

-- Same lock-down as 0009: trigger/cron-only, never callable via /rest/v1/rpc.
revoke all on function public.trigger_push_on_notification() from public, anon, authenticated;
revoke all on function public.trigger_send_reminders()       from public, anon, authenticated;
