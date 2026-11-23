# Handover to MFU: running MFU Longevity Passport on MFU's Supabase

This guide moves the app — **all users (with their passwords), health data,
teams and notifications** — from the current Supabase project
(`fqcouucedkxgocktbcre`) to a Supabase Cloud project owned by MFU, and runs the
web app from MFU's own Docker container at <https://longevity.mfu.ac.th>.

What runs where after the handover:

| Piece | Where | How it gets there |
| --- | --- | --- |
| Web app (React PWA + nginx) | **Docker container** on MFU infrastructure | `Dockerfile` — built by the GitLab CI pipeline (`.gitlab-ci.yml`, `deploy/`) or `docker compose` |
| Database and sign-in | MFU's **Supabase Cloud** project | Copied from the old project (step 3) |
| Server functions (AI, push, admin) | MFU's Supabase project → Edge Functions | `supabase functions deploy` (step 5) |
| AI model (food recognition, coach) | Anthropic API | MFU's own API key (step 5) |

Only **one container** is needed: the database and functions are hosted by
Supabase, not in containers.

> **Personal data.** The copy includes students' health records. Make sure MFU
> is the data controller of record for the new project and that the move is
> covered by the app's privacy notice / PDPA consent before running step 3.

---

## 0. What you need

- Supabase CLI (`npx supabase …` works), `psql`, Docker.
- Access to the **old** project's database password (Dashboard → Project
  Settings → Database) and the same for the new project.
- The Anthropic API key MFU will use, and the Google OAuth client if Google
  sign-in stays enabled.
- The current **VAPID key pair** (web-push keys). Reusing it means everyone's
  existing push subscriptions keep working after the move; new keys force
  every user to re-enable notifications. Get both values from the current
  owner — the private key is a secret, never commit it.

## 1. Create MFU's Supabase project

1. Create the project under MFU's organisation. **Region:** Singapore
   (`ap-southeast-1`) is closest to Chiang Rai; the old project is in Seoul.
2. **Compute size: Micro or larger, not Nano.** On 2026-11-19 the old Nano
   instance stopped answering for over an hour while CPU and memory were low —
   the free tier's limits are too tight for a shared university deployment.
3. Note the new **project ref**, **URL** (`https://<ref>.supabase.co`),
   **anon/publishable key**, and **database connection string**.

## 2. Enable the extensions the schema needs

In the new project (Dashboard → Database → Extensions, or SQL):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

(`pgcrypto`, `uuid-ossp`, `pg_graphql`, `pg_stat_statements` and
`supabase_vault` are enabled by default on new projects.)

## 3. Copy the database (roles, schema, data)

Stop writes on the old project for the duration (announce a short maintenance
window), then follow Supabase's CLI backup/restore procedure:

```bash
OLD_DB_URL='postgresql://postgres.<old-ref>:<old-password>@<old-pooler-host>:5432/postgres'
NEW_DB_URL='postgresql://postgres.<new-ref>:<new-password>@<new-pooler-host>:5432/postgres'

npx supabase db dump --db-url "$OLD_DB_URL" -f roles.sql  --role-only
npx supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
npx supabase db dump --db-url "$OLD_DB_URL" -f data.sql   --use-copy --data-only

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

The data dump includes `auth.users`, so accounts **and password hashes** come
across; people sign in with the same email and password. Everyone will have to
sign in again once (sessions are signed with the old project's key).

**Check the copy** (run on both projects and compare):

```sql
select (select count(*) from auth.users)          as users,
       (select count(*) from public.profiles)      as profiles,
       (select count(*) from public.health_scores) as scores,
       (select count(*) from public.daily_logs)    as daily_logs,
       (select count(*) from public.notifications) as notifications,
       (select count(*) from public.team_members)  as team_links,
       (select count(*) from public.profiles where role = 'admin') as admins;
```

The dump files contain personal data and password hashes — delete them once
the copy is verified.

## 4. Re-create what does not copy

**Vault secrets** are encrypted per project and do not survive the copy.
Create both in the new project (SQL editor):

```sql
-- any long random string; the SAME value goes into the NOTIFY_INTERNAL_SECRET
-- function secret in step 5
select vault.create_secret('<long-random-string>', 'notify_internal_secret');
select vault.create_secret('https://<new-ref>.supabase.co', 'project_url');
```

Without these two, notifications are still recorded in the app but push
notifications and reminders are not sent (migration `0021`).

**Reminder schedule** — check it exists, create it if not:

```sql
select jobname, schedule from cron.job;
select cron.schedule('send-reminders-every-30-min', '*/30 * * * *',
                     $$select public.trigger_send_reminders();$$);
```

## 5. Deploy the Edge Functions and set their secrets

```bash
npx supabase link --project-ref <new-ref>

npx supabase secrets set \
  ANTHROPIC_API_KEY='<MFU Anthropic key>' \
  VAPID_PUBLIC_KEY='<public key>' \
  VAPID_PRIVATE_KEY='<private key>' \
  VAPID_SUBJECT='mailto:<contact email at MFU>' \
  NOTIFY_INTERNAL_SECRET='<same string as the vault secret>' \
  ALLOWED_ORIGINS='https://longevity.mfu.ac.th,http://localhost:5173'

npx supabase functions deploy admin-users
npx supabase functions deploy delete-user
npx supabase functions deploy recognize-food
npx supabase functions deploy health-insights
npx supabase functions deploy health-chat    --no-verify-jwt
npx supabase functions deploy send-push      --no-verify-jwt
npx supabase functions deploy send-reminders --no-verify-jwt
```

- **`--no-verify-jwt` is required** on those three. `send-push` and
  `send-reminders` are called by the database with the shared secret, not a
  user token; `health-chat` checks the user's token itself. Without the flag,
  push notifications and reminders stop.
- `ALLOWED_ORIGINS` **replaces** the built-in list, so list every site that
  should be able to call the functions (add the Vercel address too if it stays
  in use).
- Optional settings: `AI_QUOTA_CHAT` (default 60), `AI_QUOTA_FOOD` (30),
  `AI_QUOTA_INSIGHTS` (6) — per user per day; `HEALTH_CHAT_MODEL`,
  `HEALTH_INSIGHTS_MODEL`, `RECOGNIZE_FOOD_MODEL` to change models.
  `DEFAULT_USER_PASSWORD` is no longer used — don't set it.

## 6. Auth settings (Dashboard → Authentication)

- **URL Configuration** — Site URL: `https://longevity.mfu.ac.th/`.
  Redirect URLs: `https://longevity.mfu.ac.th/**` and
  `https://longevity.mfu.ac.th` (both — the second covers password-reset links
  from older builds), plus `http://localhost:5173/**` for development.
- **Google sign-in** (if used) — enable the Google provider with the client ID
  and secret, and add `https://<new-ref>.supabase.co/auth/v1/callback` to the
  client's authorised redirect URIs in Google Cloud Console.
- **Emails** — set up custom SMTP (Supabase's built-in sender is rate-limited
  to a handful of emails per hour) and check the templates.
- **Password security** — turn on leaked-password protection.

## 7. Build and run the container

**With the GitLab pipeline** (`.gitlab-ci.yml`, deploys to
`longevity.mfu.ac.th`): update the protected CI/CD variables
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY` to
the **new** project's values, then run a pipeline on the `production` branch.

**On a plain server:**

```bash
# .env next to docker-compose.yml:
#   VITE_SUPABASE_URL=https://<new-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>
#   VITE_VAPID_PUBLIC_KEY=<public key>
docker compose up -d --build      # serves on :8080 — put HTTPS in front
```

The `VITE_*` values are compiled into the app at build time: changing them
means rebuilding the image. They are public values, not secrets.

## 8. Verify (before announcing the new site)

1. Sign in with an existing account and email/password → your data is there.
2. Google sign-in returns to `longevity.mfu.ac.th`, not another site.
3. Food photo → AI recognition answers; AI chat answers; Statistics → AI report.
4. Profile → Settings → enable push → a test notification arrives on a locked
   phone (`select public.notify('<your user id>', 'test', 'Test', 'Hello', '{}');`).
5. An admin account sees User Management.
6. Dashboard → Edge Functions → logs show no errors; Database → Advisors clean.

When everything passes, point users at the new site and pause or delete the
old project.
