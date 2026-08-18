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
| `DATABASE_URL` | **yes** | Postgres connection string. |
| `DB_SYNCHRONIZE` | no | `true` auto-syncs the schema from entities — dev only, never `true` in production. |
| `ENCRYPTION_KEY` | **yes** | Exactly 32 characters. AES-256 at-rest encryption for `meal.imageUrl` and `health_log.data`. **Must stay stable** — rotating or losing it makes previously-encrypted rows permanently undecryptable. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"`. |
| `JWT_SECRET` | **yes** | Signs/verifies session JWTs. |
| `CORS_ORIGIN` | no | Comma-separated list of allowed frontend origins. Defaults to `http://localhost:5173,http://localhost:3000` for local dev — set this to your deployed frontend's origin in any other environment. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, `OIDC_CALLBACK_URL` | no | MFU SSO (OIDC) login. Without these, use the `GET /auth/mock-login` dev-only stub instead. |

The server throws at startup (rather than silently falling back to an insecure default) if
`DATABASE_URL`, `JWT_SECRET`, or `ENCRYPTION_KEY` is missing or malformed.

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
