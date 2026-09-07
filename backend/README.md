# MFU Longevity Passport — Backend

NestJS + TypeORM + PostgreSQL API for the [MFU Longevity Passport](../README.md) app. Handles
auth (MFU OIDC + JWT), and logging/scoring for meals, activity, sleep, and fasting.

## Prerequisites

- Node.js v18+
- Docker (for the local PostgreSQL/TimescaleDB container)

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Defaults to `3001`. |
| `NODE_ENV` | no (yes in prod) | Set to `production` in any deployed environment. When `production`, the server refuses to start with a weak `JWT_SECRET`, `DB_SYNCHRONIZE=true`, a wrong-length `ENCRYPTION_KEY`, a missing `DATABASE_URL`, or a missing `CORS_ORIGIN`. |
| `DATABASE_URL` | **yes** | Postgres connection string. |
| `DB_SYNCHRONIZE` | no | `true` auto-syncs the schema from entities - dev only. Forced OFF whenever `NODE_ENV=production` regardless of this value. |
| `ENCRYPTION_KEY` | **yes** | Exactly 32 characters. AES-256 at-rest encryption for `meal.imageUrl` and `health_log.data`. **Must stay stable** — rotating or losing it makes previously-encrypted rows permanently undecryptable. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"`. |
| `JWT_SECRET` | **yes** | Signs/verifies session JWTs. Min 32 random characters, must not contain the words change/secret-key/dev/example. Enforced in EVERY environment - the server will not start otherwise. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `CORS_ORIGIN` | no | Comma-separated list of allowed frontend origins. Defaults to `http://localhost:5173,http://localhost:3000` for local dev — set this to your deployed frontend's origin in any other environment. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, `OIDC_CALLBACK_URL` | no | MFU SSO (OIDC) login. All six of issuer + the 4 URLs + client id/secret must be set together. When any is missing, `/auth/login` and `/auth/callback` are not registered (404). Without OIDC, use `GET /auth/mock-login` (requires `ENABLE_MOCK_LOGIN=true`, dev/non-production only). |
| `ENABLE_MOCK_LOGIN` | no | Dev only. `true` exposes `GET /auth/mock-login`, which mints a valid session JWT for a fake student with no credentials. Ignored (route stays 404) when `NODE_ENV=production`. |

The server refuses to start (rather than booting insecurely) when: `ENCRYPTION_KEY` is missing or
not exactly 32 chars (always); `JWT_SECRET` is missing, shorter than 32 chars, or contains a
placeholder word (always); or `NODE_ENV=production` and any of `DATABASE_URL` / `CORS_ORIGIN` is
missing or `DB_SYNCHRONIZE=true`. See `src/config/security-config.ts`.

## Local development

```bash
# from the repo root
npm run backend:install    # or: cd backend && npm install
npm run backend:db:up      # starts Postgres via docker-compose
npm run backend:dev        # starts Nest in watch mode on $PORT (default 3001)
```

Or from inside `backend/`:

```bash
npm install
docker compose up -d
npm run start:dev
```

## Scripts

```bash
npm run start        # start
npm run start:dev    # start in watch mode
npm run start:prod   # run the compiled build (dist/main)
npm run build         # compile with nest build
npm run lint          # eslint --fix — reformats matching files in place, review the diff before committing
npm run test          # unit tests
npm run test:e2e      # e2e tests
npm run test:cov      # coverage
npm run seed:test     # seed a test user + print a JWT (src/scripts/seed-test-user.ts)
```

There's also `src/scripts/seed-admin-user.ts` for seeding an admin user, runnable with
`ts-node -r tsconfig-paths/register src/scripts/seed-admin-user.ts`.

## Architecture notes

- **Auth**: `passport-openidconnect` for MFU SSO login, `passport-jwt` for subsequent
  request auth. `RolesGuard` + `@Roles()` gate admin-only endpoints.
- **Validation**: a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)
  is registered in `main.ts` — DTOs must carry `class-validator` decorators to actually
  enforce anything.
- **Encryption**: `EncryptionTransformer` (`src/database/encryption.transformer.ts`) is a
  TypeORM column transformer applying AES-256-GCM to specific PII/media fields. See the
  `ENCRYPTION_KEY` note above before touching it.
- **DB connection**: `TypeOrmModule.forRootAsync` is configured with `retryAttempts`/
  `retryDelay` so the server doesn't crash on boot if Postgres is still starting up.
