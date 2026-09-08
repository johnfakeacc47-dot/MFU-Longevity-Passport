# MFU Longevity Passport

The MFU Longevity Passport is a comprehensive health and longevity tracking application. It features modules for monitoring daily activity, eating habits, mental health, and sleep patterns to help users maintain a healthy lifestyle.

## Features

- **Activity Tracking**: Monitor daily physical activities.
- **Eating & Diet**: Log dietary habits. Food Recognition runs a local TensorFlow.js
  model for 10 Thai dishes, or a cloud AI engine (Claude vision) for any dish —
  toggle per user.
- **Mental Health**: Track mental well-being and stress levels.
- **Sleep Tracking**: Keep logs of sleep quality and duration.
- **Longevity score**: 4-pillar daily score that resets at 00:00 Asia/Bangkok; each
  day is frozen into Supabase for history and analytics.
- **Dashboard**: A comprehensive overview of health metrics, historical trends, and
  an AI-written period report.
- **AI Health Coach**: A chat assistant grounded in the user's own logged data,
  longevity points, the weekly wellness challenge, and their team.
- **Team & Wellness Challenges**: Compare progress with a team; add teammates by a
  short handle or QR code.
- **Goal Setting**: Set and monitor personal health goals.
- **PWA Support**: Installable as a Progressive Web App.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: Tailwind CSS v4, Mantine UI components
- **Backend & Database**: NestJS backend with PostgreSQL; Supabase (auth, `profiles` +
  health tables, Edge Functions, Row Level Security)
- **Machine Learning**: TensorFlow.js for on-device food recognition (lazy-loaded —
  the ~1 MB model bundle and weights load only when the camera opens, and the
  weights are cached by the service worker on first use rather than precached).
- **AI**: Anthropic Claude API, called only from Edge Functions (the API key never
  reaches the browser). Provider is isolated to one function per feature and is
  swappable to Gemini without touching the frontend contract.

### Where each concern lives

| Concern | Runs in |
| --- | --- |
| Sign-in, session, user data (`profiles`, `health_scores`, `challenges`, `team_members`, `chat_messages`, `ai_reports`, `daily_logs`) | Supabase, protected by Row Level Security |
| Cross-device sync of raw meal / activity / sleep / water logs | `daily_logs` jsonb table + `services/dailyLogsSync.ts` (debounced push, union-on-pull) |
| Privileged user management (list / create / update / delete users) | `admin-users` Supabase Edge Function (verifies caller is `role = 'admin'`) |
| Self-service account deletion | `delete-user` Supabase Edge Function |
| Adding a teammate by handle / QR code | `find_profile_by_handle` + `add_team_member_by_handle` SECURITY DEFINER RPCs (`authenticated` only) |
| Cloud food recognition (vision LLM) | `recognize-food` Edge Function — `recognizeFood()` is the only provider-specific piece |
| AI weekly / period report | `health-insights` Edge Function — reads `health_scores`, caches in `ai_reports` |
| AI health-coach chat (streamed) | `health-chat` Edge Function — grounds the reply in the caller's profile, health data, wellness challenge and team; appends each turn to `chat_messages`. `verify_jwt` is off (the function verifies the JWT itself) so the browser CORS preflight is not gated. |
| Meal / activity / sleep / fasting logging + scoring API | NestJS backend + its own PostgreSQL |

The frontend only ever holds the Supabase **anon** key. A `service_role` key must never be
placed in a `VITE_`-prefixed variable — it would be inlined into the browser bundle.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- Docker (for the local NestJS database)
- Supabase CLI (for applying the RLS migration and deploying Edge Functions)

### Installation

1. Clone the repository and install frontend dependencies:
   ```bash
   npm install
   ```

2. Install backend dependencies:
   ```bash
   npm run backend:install
   ```

3. **Frontend environment**: copy `.env.example` to `.env` and fill in your Supabase project
   URL, anon key, and the backend API URL (`VITE_API_URL`). Do **not** add a service-role key.

4. **Backend environment**: copy `backend/.env.example` to `backend/.env` and set the values.

   `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` are **required** — the backend fails
   fast on startup if any is missing, weak, or a placeholder. `JWT_SECRET` must be at least
   32 random characters and must not contain the words `change` / `secret-key` / `dev` /
   `example`. Generate the two secrets with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"   # ENCRYPTION_KEY (exactly 32 chars)
   ```

   `ENCRYPTION_KEY` must stay stable once set — rotating it makes previously-encrypted rows
   permanently undecryptable. See [backend/README.md](backend/README.md) for the full list.

5. **Supabase** (first-time setup, or when `supabase/migrations/` changes):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push                       # applies every file in supabase/migrations/
                                          #   0001_enable_rls, 0002_user_handles, 0003_chat_messages,
                                          #   0004_profile_goal_activity, 0005_daily_logs

   supabase functions deploy admin-users
   supabase functions deploy delete-user
   supabase functions deploy recognize-food
   supabase functions deploy health-insights
   supabase functions deploy health-chat --no-verify-jwt   # verifies the JWT in code; keeps CORS preflight working

   supabase secrets set ALLOWED_ORIGINS="http://localhost:5173"   # + every deployed origin
   supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."            # required by recognize-food / health-insights / health-chat
   # optional model overrides: RECOGNIZE_FOOD_MODEL, HEALTH_INSIGHTS_MODEL, HEALTH_CHAT_MODEL
   ```

   Read [supabase/RLS_ROLLOUT.md](supabase/RLS_ROLLOUT.md) before applying `0001` — it
   enables Row Level Security and changes which rows the anon key can see, and must ship
   together with the frontend build that routes admin operations through `admin-users`.
   `ANTHROPIC_API_KEY` is a paid credential — the AI features return a graceful
   "unavailable" message if the account has no credit.

### Running the Application

1. Start the local database using Docker:
   ```bash
   npm run backend:db:up
   ```

2. Start the backend development server:
   ```bash
   npm run backend:dev
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`.

## Security & deployment checklist

Before (or immediately after) the first deploy that includes these changes:

- [ ] **Rotate the Supabase `service_role` key** (Dashboard → Project Settings → API). A prior
      build shipped it in the browser bundle, so it must be treated as public. Deployed Edge
      Functions pick up the new value automatically.
- [ ] Remove `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_ENABLE_DEV_LOGIN`, `VITE_ENABLE_DEV_ACCESS`,
      and `VITE_DEV_LOGIN_PIN` from the hosting/CI environment (all environments).
- [ ] `git rm --cached .env.development` and commit (it was tracked; `.gitignore` now covers it).
- [ ] Apply `supabase/migrations/0001_enable_rls.sql` and deploy the `admin-users` +
      `delete-user` Edge Functions; set `ALLOWED_ORIGINS` to every real frontend origin.
- [ ] Set the backend production env: `NODE_ENV=production`, a strong `JWT_SECRET`,
      `DB_SYNCHRONIZE=false`, a 32-char `ENCRYPTION_KEY`, and `CORS_ORIGIN` = the real frontend
      origin(s). The backend refuses to boot if any of these is missing or unsafe.
- [ ] In `vercel.json`, replace `https://REPLACE_WITH_PROD_API_ORIGIN` in the CSP `connect-src`
      with the real backend origin (or delete the token if the backend is same-origin).
- [ ] Rebuild and redeploy the frontend, then verify the bundle is clean:
      `npm run build && grep -rEi "sb_secret|service_role" dist/` (must return nothing).

## Documentation

For details on the development process, branching strategies, security conventions, and
contribution guidelines, please refer to [process.md](process.md).
