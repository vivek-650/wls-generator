# @wlr/api

Express + TypeScript backend for the White Label Resume Generator. Owns auth, multi-tenant data access (Postgres), orchestration of `services/parser`, PDF export (`@react-pdf/renderer`), and file storage (Cloudinary). See `docs/architecture.md` and `docs/database-schema.md` at the repo root for the full contract.

## Project layout

```
migrations/            001_init.sql — schema source of truth, applied by `npm run migrate`
src/
  index.ts               boot: connect DB, start listening
  app.ts                 express app + middleware + route mounting under /api
  config/env.ts           typed env loading, fails fast on missing required vars
  db/pool.ts, db/migrate.ts
  middleware/auth.ts        requireAuth, requireRole
  middleware/errorHandler.ts
  errors/AppError.ts
  repositories/             raw SQL via `pg`; company-scoped tables go through withCompanyScope()
  services/                 business logic
  clients/parserClient.ts    calls services/parser over native fetch
  clients/cloudinaryClient.ts
  pdf/ResumeDocument.tsx      white-label PDF template
  routes/*.routes.ts
  validation/*.ts             zod schemas
  scripts/seedSuperAdmin.ts
tests/                     supertest integration tests (see below)
```

## Setup

```bash
npm install                      # from the repo root (npm workspaces)
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — at minimum JWT_SECRET; DATABASE_URL default matches docker-compose.yml
```

### Local Postgres (dev + tests)

No Docker required — use a native PostgreSQL install (17.x). On Windows the easiest path is `winget install --id PostgreSQL.PostgreSQL.17 -e`, but any local Postgres 14+ works.

Rather than fighting the Windows-service instance's admin-only auth, run a second, user-owned cluster dedicated to this project (no admin rights needed, isolated from anything else on the machine):

```bash
# one-time setup, from apps/api/
"C:\Program Files\PostgreSQL\17\bin\initdb.exe" -D ".pgdata-local" -U postgres -A trust -E UTF8

# start it whenever you're developing (binds to 127.0.0.1 only)
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D ".pgdata-local" -l ".pgdata-local/server.log" -o "-p 5544 -c listen_addresses=127.0.0.1" start

# one-time: create the app role + database
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5544 -d postgres \
  -c "CREATE ROLE wlr LOGIN PASSWORD 'wlr' CREATEDB;" \
  -c "CREATE DATABASE wlr OWNER wlr;"

# stop it when you're done
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D ".pgdata-local" stop
```

`.pgdata-local/` is gitignored — it's a disposable local cluster, not something to commit or share. `DATABASE_URL` in `.env` should then be `postgres://wlr:wlr@127.0.0.1:5544/wlr` (port 5544, not the Postgres default 5432, to avoid colliding with any other local Postgres instance/service on the machine — `citext` and `pgcrypto` are both "trusted" extensions in Postgres 13+, so the non-superuser `wlr` role can `CREATE EXTENSION` them itself, which `npm run migrate` does automatically).

```bash
npm run migrate                  # applies migrations/*.sql in order, tracked in schema_migrations
npm run seed:super-admin         # upserts a SUPER_ADMIN from SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD
```

`npm run migrate` is idempotent — safe to re-run; it skips anything already recorded in `schema_migrations`.

### Run the API

```bash
npm run dev --workspace=apps/api     # tsx watch, from repo root
# or, inside apps/api:
npm run dev
```

Serves on `http://localhost:4000`, all routes under `/api` (e.g. `POST /api/auth/login`). `services/parser` is expected at `PARSER_SERVICE_URL` (default `http://localhost:8001`) for the upload flow to work outside tests.

### Build

```bash
npm run build --workspace=apps/api   # tsc -> dist/
npm start --workspace=apps/api       # node dist/index.js
```

## Tests

Integration tests (`tests/*.test.ts`, Jest + Supertest) run against the same local Postgres cluster set up above — they do **not** require `services/parser` to be running: `src/clients/parserClient.ts` and `src/clients/cloudinaryClient.ts` are swapped for manual mocks (`src/clients/__mocks__/*`, activated per-file with `jest.mock(...)`) so upload/export flows are exercised end-to-end against real Postgres with a fixed sample `ParsedResume` and fake Cloudinary URLs. File uploads use a tiny synthetic PDF buffer (`tests/testHelpers.ts` `MINIMAL_PDF_BUFFER`) rather than a real resume on disk — its content is irrelevant since the parser is mocked, and it means the suite never depends on personal-data fixture files being present.

**Safety guard**: `resetDb()` truncates every table in `beforeAll`, and `apps/api/.env`'s `DATABASE_URL` is the same file used for real dev/prod runs against Supabase — so `tests/testHelpers.ts` refuses to run (throws immediately, before touching anything) unless `DATABASE_URL`'s host is `localhost`/`127.0.0.1`. If `.env` is currently pointed at Supabase, override it for the test run instead of editing the file:
```bash
DATABASE_URL=postgres://wlr:wlr@127.0.0.1:5544/wlr npm test --workspace=apps/api
```

```bash
cd apps/api
# ensure the local Postgres cluster (see above) is running and migrated
npm run migrate
npm test
```

Coverage:
- `tests/auth.test.ts` — register -> login -> `/auth/me`, duplicate-email 409, bad-credentials 401, refresh rotation (old cookie revoked, new one works), logout.
- `tests/candidates.test.ts` — upload persists a hydrated `Candidate` from the mocked parser response, rejected file types, a parser 422 propagates without leaving an orphaned candidate row, list/get/patch, export -> `GeneratedResume`, re-export overwrites the same PDF/row instead of creating a new one, soft delete (hidden from the API, row still present in the database).
- `tests/isolation.test.ts` — company B can never read/list/update/delete company A's candidate or see A's branding (403/404 only).
- `tests/admin.test.ts` — non-SUPER_ADMIN blocked from `/admin/*`; SUPER_ADMIN lists companies/stats; deactivating a company immediately 403s that company's already-issued access token (checked live against the DB in `requireAuth`, not cached) and blocks fresh logins; reactivating restores access.

Each test file truncates all tables in `beforeAll` (`tests/testHelpers.ts`) so they can run in any order against the shared local DB; run with `--runInBand` (the default `npm test` script) since they share one database.

## Production (Supabase)

```bash
DATABASE_URL="postgres://...supabase connection string..." npm run migrate --workspace=apps/api
DATABASE_URL="..." SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... npm run seed:super-admin --workspace=apps/api
npm run build --workspace=apps/api
NODE_ENV=production PORT=4000 DATABASE_URL="..." JWT_SECRET="..." CLOUDINARY_CLOUD_NAME="..." \
  CLOUDINARY_API_KEY="..." CLOUDINARY_API_SECRET="..." PARSER_SERVICE_URL="..." FRONTEND_URL="..." \
  npm start --workspace=apps/api
```

`NODE_ENV=production` relaxes TLS certificate verification for `pg` (`src/db/pool.ts`) to accommodate Supabase's pooled endpoint, and switches the refresh-token cookie to `Secure`/`SameSite=None` for a cross-domain frontend.

## Auth model

- Access token: JWT (`AccessTokenClaims` from `@wlr/shared-types`), 15 min TTL (`JWT_ACCESS_TTL`), returned only in the JSON body — never a cookie.
- Refresh token: random 32-byte hex value; only its SHA-256 hash is stored (`refresh_tokens.token_hash`); set as an `httpOnly` cookie named `refresh_token` scoped to `/api/auth`; rotated (old row revoked, new row + cookie issued) on every `/api/auth/refresh` call.
- `requireAuth` (`src/middleware/auth.ts`) verifies the JWT and, for every non-`SUPER_ADMIN` request, re-checks the company's `status` in the DB on that request — a company flipped to `inactive` immediately 403s all of its users' subsequent requests, even with an unexpired token.
- There is no public way to create a `SUPER_ADMIN`; run `npm run seed:super-admin` (reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`) once per environment.
- `src/repositories/withCompanyScope.ts` — every company-scoped repository function takes a `CompanyScope` (not a raw string), obtainable only via `withCompanyScope(companyId)`, which throws on an empty id. This keeps every candidate/child-table/generated-resume query structurally tied to `req.user.companyId`.
