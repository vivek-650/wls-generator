# Setup

Full local setup for all three services: `services/parser` (Python), `apps/api` (Express), `apps/web` (Next.js). No Docker required — everything runs as native local processes.

## Prerequisites

- Node.js 20+ (developed against v22)
- Python 3.11+
- PostgreSQL 14+ (Windows: `winget install --id PostgreSQL.PostgreSQL.17 -e`; macOS: `brew install postgresql@17`; Linux: your package manager)
- A [Cloudinary](https://cloudinary.com) account (free tier) — cloud name, API key, API secret from the dashboard's "API Keys" page

## 1. Install JS dependencies (repo root)

```bash
npm install
npm run build --workspace=packages/shared-types
```

`apps/api` and `apps/web` both depend on `@wlr/shared-types` as an npm workspace package — build it first so its `dist/` exists.

## 2. Local Postgres

You can point straight at a Supabase project's connection string (skip to step 3), or run Postgres locally. To avoid fighting OS-level service permissions, run a second, user-owned cluster dedicated to this project rather than using the system service:

```bash
# from apps/api/, one-time
initdb -D ".pgdata-local" -U postgres -A trust -E UTF8

# start it whenever developing (binds to 127.0.0.1 only; pick any free port)
pg_ctl -D ".pgdata-local" -l ".pgdata-local/server.log" -o "-p 5544 -c listen_addresses=127.0.0.1" start

# one-time: create the app role + database
psql -U postgres -h 127.0.0.1 -p 5544 -d postgres \
  -c "CREATE ROLE wlr LOGIN PASSWORD 'wlr' CREATEDB;" \
  -c "CREATE DATABASE wlr OWNER wlr;"
```

(On Windows, prefix each binary with its full path, e.g. `"C:\Program Files\PostgreSQL\17\bin\initdb.exe"` — see `apps/api/README.md` for the exact commands used during development.)

`citext` and `pgcrypto` (used by the schema) are both "trusted" extensions in Postgres 13+, so the non-superuser `wlr` role can create them itself — the migration handles this automatically, no extra grants needed.

## 3. Configure `apps/api`

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:
- `DATABASE_URL` — `postgres://wlr:wlr@127.0.0.1:5544/wlr` for the local cluster above, or your Supabase connection string
- `JWT_SECRET` — any long random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — from your Cloudinary dashboard
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` — credentials for the platform admin account (only used by the seed script, see below)

Then:

```bash
npm run migrate --workspace=apps/api        # applies apps/api/migrations/001_init.sql
npm run seed:super-admin --workspace=apps/api  # creates the one SUPER_ADMIN account
```

## 4. Configure & run `services/parser`

```bash
cd services/parser
python -m venv .venv
.venv\Scripts\activate        # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Runs on `http://localhost:8001`. Verify with `curl http://localhost:8001/health`.

## 5. Run `apps/api`

In a separate terminal, from the repo root:

```bash
npm run dev --workspace=apps/api
```

Runs on `http://localhost:4000`, all routes under `/api`. Verify with `curl http://localhost:4000/api/health`. Requires `services/parser` to be running for the resume-upload flow to work; auth/branding/admin routes work without it.

## 6. Configure & run `apps/web`

```bash
cp apps/web/.env.example apps/web/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000/api (already the default)

npm run dev --workspace=apps/web
```

Open `http://localhost:3000`. Register a company (creates its first `COMPANY_ADMIN`), or log in as the seeded `SUPER_ADMIN` (`/admin`) with the credentials from step 3.

## Running the test suites

```bash
npm run build --workspace=packages/shared-types

# apps/api — real integration tests against the local Postgres from step 2
# (parser + Cloudinary are mocked, so services/parser doesn't need to be running)
npm test --workspace=apps/api

# services/parser — pytest against the real fixture resumes in samples/fixtures/
cd services/parser && .venv\Scripts\activate && pytest tests/ -v
```

`apps/api`'s test suite truncates its tables between runs — re-run `npm run seed:super-admin --workspace=apps/api` afterward if you need the platform admin account back for manual testing.

## Verifying end-to-end (what was used to produce `samples/`)

```bash
# register a company
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Recruiting","name":"Ada Admin","email":"ada@acme.test","password":"Password123!"}'

# log in, upload a real fixture resume, export the white-label PDF
# (see docs/architecture.md for the full route contract)
```

`samples/parsed-resume-example.json` and `samples/white-labeled-resume-sample.pdf` in this repo were produced this way, from `samples/fixtures/python-developer-resume.pdf`.
