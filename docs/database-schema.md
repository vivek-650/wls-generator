# Database Schema

Postgres, hosted on Supabase. Supabase is used purely as managed Postgres — **Supabase Auth is not used**; authentication is implemented in `apps/api` against the `users` table. Migration source of truth: [`apps/api/migrations/001_init.sql`](../apps/api/migrations/001_init.sql).

## Entity overview

```
companies (1) ──< users (many)
companies (1) ──< candidates (many)
users     (1) ──< refresh_tokens (many)
candidates(1) ──< work_experience, education, certifications, projects, candidate_skills
candidates(1) ──< parsed_resumes (audit trail of raw parser output)
candidates(1) ──< generated_resumes (exported white-label PDFs)
```

## Tables

### `companies`
The tenant. One row per registered company.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | shown as "Prepared & Submitted By: {name}" on exports |
| logo_url | text | Cloudinary URL, nullable until branding is configured |
| theme_color | text | hex, applied to the white-label PDF template |
| footer_text | text | nullable, printed in the PDF footer |
| status | enum `active`\|`inactive` | set by a `SUPER_ADMIN`; `inactive` blocks all of that company's users at auth middleware |
| created_at / updated_at | timestamptz | |

### `users`
Both company users and the platform Super Admin live in one table, distinguished by `role`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid fk → companies, **nullable** | null only for `role = SUPER_ADMIN` (check constraint enforces this) |
| email | citext unique | case-insensitive unique |
| password_hash | text | bcrypt |
| name | text | |
| role | enum `SUPER_ADMIN`\|`COMPANY_ADMIN`\|`COMPANY_MEMBER` | see [Roles](#roles--multi-tenancy) |
| created_at | timestamptz | |

### `refresh_tokens`
One row per active session, enabling rotation and revocation.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk → users | |
| token_hash | text unique | never store the raw token |
| expires_at | timestamptz | |
| revoked_at | timestamptz nullable | set on logout / rotation |

### `candidates`
The parsed candidate profile. Always scoped to a `company_id`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid fk → companies | every query in the API is filtered by this — see [Data isolation](#data-isolation) |
| created_by | uuid fk → users | who uploaded it |
| full_name, email, phone, location, summary | text | editable after parsing |
| source_file_url | text | original upload, Cloudinary URL |
| source_file_type | enum `pdf`\|`docx` | |
| created_at / updated_at | timestamptz | |

### `work_experience`, `education`, `certifications`, `projects`
Child tables of `candidates`, one row per entry, ordered by `sort_order`. Fields mirror the `ParsedResume` shared type (`packages/shared-types/src/parsedResume.ts`) so the parser output maps 1:1 into rows.

### `candidate_skills`
Normalized (not JSON) so skills are filterable/searchable: `(candidate_id, skill, category)`.

### `parsed_resumes`
Full raw JSON returned by the Python parser (`raw_json jsonb`) plus `parser_version`, kept for audit/debugging and so re-parsing logic can be improved without re-uploading files.

### `generated_resumes`
One row per white-label PDF export: `candidate_id`, `company_id`, `pdf_url` (Cloudinary), `created_at`.

## Roles & multi-tenancy

- **`COMPANY_ADMIN`** — full control of their own company: branding, candidates, inviting `COMPANY_MEMBER` users.
- **`COMPANY_MEMBER`** — upload/manage candidates and export resumes; cannot touch branding or users.
- **`SUPER_ADMIN`** — platform operator, `company_id = NULL`, not created via public signup (bootstrapped by a seed script). Operates through `/admin/*` routes only: list companies, activate/deactivate, view platform-wide stats.

### Data isolation

Every company-scoped table carries `company_id` (directly, or via `candidate_id` → `candidates.company_id`). All repository functions in `apps/api` require an explicit `companyId` argument sourced from the authenticated request (`req.user.companyId`), never from the URL/body, and every query is filtered by it — so one company can never read or write another company's rows. A deactivated company (`status = 'inactive'`) has all of its users rejected at the auth middleware before any query runs.
