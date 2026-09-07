# Development Process

This document outlines the standard development workflow and guidelines for the MFU Longevity Passport project.

## Workflow

1. **Branching Strategy**: 
   - `main`: Production-ready code.
   - `dev`: Active development branch.
   - Feature branches should be created from `dev` and named descriptively (e.g., `feature/food-recognition`, `fix/sleep-tracker-bug`).

2. **Commit Guidelines**:
   - Write clear and descriptive commit messages.
   - Use conventional commits format (e.g., `feat: add activity dashboard`, `fix: correct layout on mobile`).

3. **Pull Requests**:
   - Open a Pull Request against the `dev` branch.
   - Ensure all tests and linting checks pass before requesting a review.
   - Request at least one code review from a team member.

## Environment Management

- **Frontend**: Environment variables go in a `.env` file at the root. Prefix variables read by
  the frontend with `VITE_`. **Every `VITE_` variable is inlined into the browser bundle** — never
  put a secret there. The frontend gets only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `VITE_API_URL`. A Supabase `service_role` / `sb_secret_` key must never appear in a `VITE_` var
  or anywhere in `src/`; privileged operations run in the `admin-users` Edge Function instead.
- `.env`, `.env.*` (and `backend/.env`) are gitignored; only `*.example` files are tracked.
- **Backend**: Managed via `backend/.env`. Sensitive keys are never committed.
  - `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` are required — the backend **refuses to
    start** (rather than falling back to an insecure default) if any is missing. See
    [backend/README.md](backend/README.md) for the full list.
  - `JWT_SECRET` must be at least 32 random characters and must not contain the words
    `change` / `secret-key` / `dev` / `example`. This is enforced in **every** environment.
  - `ENCRYPTION_KEY` must be exactly 32 characters and stay stable once set. It's used for
    AES-256 at-rest encryption of `meal.imageUrl` and `health_log.data` — rotating or losing it
    makes previously-encrypted rows permanently undecryptable. A decrypt failure now **throws**
    (fails loud) instead of silently returning ciphertext.
  - `CORS_ORIGIN` (comma-separated) is the allow-list of frontend origins; the localhost
    default is dev-only. Required in production.
  - **Production config guard** (`src/config/security-config.ts`): when `NODE_ENV=production`
    the server refuses to boot if `JWT_SECRET` is weak, `DB_SYNCHRONIZE=true`, `ENCRYPTION_KEY`
    is the wrong length, or `DATABASE_URL` / `CORS_ORIGIN` is missing. `DB_SYNCHRONIZE` is also
    force-disabled in production regardless of its value.
  - `ENABLE_MOCK_LOGIN=true` (dev/non-production only) exposes `GET /auth/mock-login`, which
    mints a session JWT with no credentials. It 404s in production regardless.
  - OIDC SSO is all-or-nothing: set **all six** `OIDC_*` values together, or `/auth/login` and
    `/auth/callback` are not registered.

## Supabase

- **Row Level Security is the source of truth** for who can read/write `profiles`,
  `health_scores`, `challenges`, and `team_members`. The frontend holds only the anon key;
  RLS — not application code — is what stops one user reading another's data.
- Schema/policy changes go in `supabase/migrations/` as numbered `.sql` files. Apply with
  `supabase db push`. Read [supabase/RLS_ROLLOUT.md](supabase/RLS_ROLLOUT.md) first — enabling
  RLS changes which rows the anon key sees and must ship together with the matching frontend
  build.
- **Privileged / cross-user operations** (listing all users, creating users, deleting an
  account) run server-side in `supabase/functions/admin-users/` and `supabase/functions/delete-user/`,
  which verify the caller's JWT and role before using the `service_role` key. Frontend code
  calls them via `supabase.functions.invoke(...)` — never the anon client directly.
- **Cloud food recognition** (`supabase/functions/recognize-food/`) proxies a vision LLM so
  the API key never reaches the browser. The provider is isolated to one function
  (`recognizeFood()`) — currently Claude (`ANTHROPIC_API_KEY`), swappable to Gemini without
  touching the frontend or the response contract. The local TensorFlow.js model still handles
  the 10 Thai dishes; a per-user toggle (`localStorage.foodRecognitionEngine`) picks the engine.
- Edge Functions restrict CORS to the `ALLOWED_ORIGINS` secret (comma-separated); set it per
  environment with `supabase secrets set`. Never put a model/provider API key in a `VITE_` var.

## Frontend Stability Conventions

- **Error boundaries**: The app is wrapped in a top-level `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) so an uncaught render error shows a recoverable "Reload" screen instead of a blank white screen. Feature-specific boundaries (like the one around `FoodRecognition`) are still fine for isolating risky subtrees, but don't rely on them as the only safety net.
- **localStorage reads**: Always read/parse `localStorage` via `safeGetItem`/`safeParse` (`src/utils/safeStorage.ts`) instead of raw `JSON.parse(localStorage.getItem(...))`. A single malformed value would otherwise throw during render with no boundary catching it in time, white-screening the app.

## Security Conventions

- **No secrets in the frontend.** See Environment Management — nothing sensitive in a `VITE_`
  variable or `src/`. Admin / cross-user Supabase work goes through the `admin-users` Edge
  Function; the anon client is only ever used for the current user's own rows.
- **Dev-only entry points are compile-time gated.** The Developer Quick Login button
  (`Login.tsx`), the PIN modal (`DevLoginModal.tsx` — no hardcoded fallback), and the
  `dev-user` localStorage bypass (`App.tsx`) are all guarded by `import.meta.env.DEV`, so they
  are dead-code-eliminated from production builds. Don't reintroduce `import.meta.env.MODE`
  or `VITE_ENABLE_*` env-var gating for these — a stray var in a deployed environment must not
  be able to expose them.
- **Production console output is stripped.** `vite.config.ts` drops `console.*` / `debugger`
  from production builds; `healthApi.ts` also guards its own logging behind `import.meta.env.DEV`
  and throws generic (non-leaking) errors in production. Debug via Vercel runtime logs, the
  `ErrorBoundary`, or analytics — not `console` in prod.
- **CSP**: `vercel.json` sets a Content-Security-Policy and related headers on deployed
  responses. If you add a new external origin (script, image, API, font), update `connect-src` /
  `img-src` / `script-src` accordingly and test in `Content-Security-Policy-Report-Only` mode
  first.
- **Backend access control**: admin-only routes use `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles(UserRole.Admin)` (auth guard first, always). Self-service routes (`PATCH /users/me`,
  `GET /users/me/export`) use a name/email-only DTO so the global `ValidationPipe`
  (`forbidNonWhitelisted`) rejects any attempt to send `role`. HTTP responses return an explicit
  `UserResponseDto`, never a raw TypeORM entity.
- Run a `security-review` / adversarial pass on changes that touch auth, RLS policies, Edge
  Functions, or the config guards before merging.

## Available Scripts

### Frontend Scripts
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run preview`: Previews the production build locally.

### Backend Scripts
- `npm run backend:install`: Installs dependencies for the backend.
- `npm run backend:dev`: Starts the backend server in development mode.
- `npm run backend:build`: Builds the backend.
- `npm run backend:start`: Starts the built backend in production mode.
- `npm run backend:db:up`: Spins up the local database using Docker Compose.
- `npm run backend:db:down`: Tears down the local database containers.

## Testing & Quality Assurance

- Always run `npm run lint` before committing. Note the backend `lint` script runs `eslint --fix`
  and will reformat files in place — review the diff and don't commit unrelated reformatting.
- Write unit tests for critical utility functions and hooks.
- Test across different devices as this application is a Progressive Web App (PWA) and is expected to be used on mobile.
- After changes that touch secrets or the Supabase client, verify the production bundle is clean:
  `npm run build && grep -rEi "sb_secret|service_role" dist/` must return nothing.
