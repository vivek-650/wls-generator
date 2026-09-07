# White Label Resume Generator

Upload a candidate's resume (PDF/DOCX), parse it into structured data with a **non-LLM, hybrid NLP pipeline**, review/edit the result, then export a clean PDF resume carrying your own company's branding instead of the original formatting. Multi-tenant: any company can register and manage its own isolated candidates and branding; a platform Super Admin manages which companies are active.

## Stack

| Service | Tech | Role |
|---|---|---|
| `apps/web` | Next.js 14 (App Router) + Tailwind | UI — talks only to `apps/api` |
| `apps/api` | Express + TypeScript | Auth, multi-tenant data access, orchestration, PDF export, Cloudinary |
| `services/parser` | Python 3.11 + FastAPI | Stateless resume parsing (PyMuPDF/python-docx + spaCy NER + skill-taxonomy phrase-matching — no LLM) |
| `packages/shared-types` | TypeScript | Single source of truth for every request/response shape |
| Database | PostgreSQL (Supabase-hosted in prod) | Auth is hand-rolled against this DB — Supabase Auth is not used |
| File storage | Cloudinary | Original resumes, company logos, generated PDFs |

See [`docs/architecture.md`](docs/architecture.md) for the full request/response contract between all three services and the parsing pipeline design, and [`docs/database-schema.md`](docs/database-schema.md) for the schema and multi-tenancy/data-isolation model.

## Quick start

Full instructions: [`docs/setup.md`](docs/setup.md). Short version:

```bash
npm install
npm run build --workspace=packages/shared-types

# 1. Postgres running locally (or a Supabase connection string) + apps/api/.env configured
npm run migrate --workspace=apps/api
npm run seed:super-admin --workspace=apps/api

# 2. parser service
cd services/parser && .venv\Scripts\activate && uvicorn app.main:app --port 8001

# 3. API
npm run dev --workspace=apps/api        # http://localhost:4000

# 4. frontend
npm run dev --workspace=apps/web        # http://localhost:3000
```

## Roles & multi-tenancy

- **`COMPANY_ADMIN`** / **`COMPANY_MEMBER`** — belong to one company; can only ever see that company's candidates/branding (enforced structurally in `apps/api`'s repository layer, not just at the route level).
- **`SUPER_ADMIN`** — platform operator, not created via public signup; manages which companies are active and views platform-wide stats at `/admin`.

## Samples

- [`samples/fixtures/`](samples/fixtures) — two real resumes used to build and test the parser
- [`samples/parsed-resume-example.json`](samples/parsed-resume-example.json) — real parser output for one of them
- [`samples/white-labeled-resume-sample.pdf`](samples/white-labeled-resume-sample.pdf) — the resulting white-labeled export

## Why not an LLM for parsing?

The assignment explicitly calls for a real parsing engine, not an LLM wrapper. `services/parser` extracts text with font/layout metadata (PyMuPDF/python-docx), segments it into sections via header detection, then runs targeted extractors per section: regex + `phonenumbers` for contact info, spaCy NER for name/location, and a spaCy `PhraseMatcher` over a curated skills taxonomy for skills. See [`services/parser/README.md`](services/parser/README.md) for the full pipeline writeup, including real bugs found and fixed against the two sample resumes.
