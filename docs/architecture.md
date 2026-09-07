# Architecture

## Services

```
apps/web        Next.js 14 (App Router) + Tailwind — UI only, talks exclusively to apps/api
apps/api         Express + TypeScript — auth, orchestration, DB access, PDF export, Cloudinary
services/parser  Python 3.11 + FastAPI — stateless resume parsing (PDF/DOCX -> ParsedResume JSON)
packages/shared-types  TS types shared by web + api (source of truth for all request/response shapes)
```

`apps/web` never talks to `services/parser` or the database directly — everything goes through `apps/api`. `services/parser` is stateless and has no DB/auth knowledge: it takes a file, returns `ParsedResume` JSON (shape defined in `packages/shared-types/src/parsedResume.ts`), and is called synchronously by `apps/api` over internal HTTP.

## Shared types

`packages/shared-types/src/*.ts` is the single source of truth for every request/response body in this system:
- `roles.ts` — `UserRole`, `CompanyStatus`
- `parsedResume.ts` — the parser service's output contract
- `candidate.ts` — DB-hydrated candidate shape + `UpdateCandidateRequest`
- `branding.ts` — `Company`, `UpdateBrandingRequest`
- `auth.ts` — `RegisterRequest`, `LoginRequest`, `AuthResponse`, `AuthUser`, `AccessTokenClaims`
- `admin.ts` — `AdminCompanySummary`, `PlatformStats`

`apps/api` and `apps/web` both depend on `@wlr/shared-types` (npm workspace package) and must import these types rather than redeclaring shapes.

## REST API contract (`apps/api`)

Base path `/api`. JSON everywhere except file upload endpoints (`multipart/form-data`) and PDF download (binary/redirect to Cloudinary URL). Every response body matches the shared type named in parentheses.

Errors: `{ "error": { "message": string, "code"?: string } }` with status 400 (validation), 401 (no/invalid/expired access token), 403 (wrong role, or company `inactive`), 404, 409 (e.g. duplicate email on register), 422 (upload not a parseable pdf/docx), 500.

### Auth (public except `/me`)
| Method & path | Body | Response | Notes |
|---|---|---|---|
| POST /api/auth/register | `RegisterRequest` | 201 `AuthResponse` | creates `companies` row + first user as `COMPANY_ADMIN` in one transaction; sets `refresh_token` httpOnly cookie |
| POST /api/auth/login | `LoginRequest` | 200 `AuthResponse` | sets `refresh_token` cookie |
| POST /api/auth/refresh | — (reads cookie) | 200 `{ accessToken: string }` | rotates refresh token |
| POST /api/auth/logout | — | 204 | revokes refresh token, clears cookie |
| GET /api/auth/me | — (auth required) | 200 `AuthUser` | |

Access token: short-lived JWT (15 min), returned in the JSON body only (never a cookie) — the frontend keeps it in memory (React context) and sends `Authorization: Bearer <token>`. On a 401 from an expired token, the frontend calls `/api/auth/refresh` once and retries the original request; a second 401 forces logout.

### Company / branding (auth required)
| Method & path | Role | Body | Response |
|---|---|---|---|
| GET /api/company | any company role | — | 200 `Company` |
| PATCH /api/company/branding | `COMPANY_ADMIN` | `UpdateBrandingRequest` | 200 `Company` |
| POST /api/company/logo | `COMPANY_ADMIN` | multipart `logo` (image) | 200 `Company` (uploads to Cloudinary, sets `logo_url`) |
| GET /api/company/users | `COMPANY_ADMIN` | — | 200 `AuthUser[]` |
| POST /api/company/users | `COMPANY_ADMIN` | `{ name, email, password }` | 201 `AuthUser` (role forced to `COMPANY_MEMBER`) |
| DELETE /api/company/users/:id | `COMPANY_ADMIN` | — | 204 |

### Candidates (auth required, always scoped to `req.user.companyId`)
| Method & path | Role | Body | Response |
|---|---|---|---|
| POST /api/candidates/upload | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | multipart `file` (pdf/docx) | 201 `Candidate` |
| GET /api/candidates | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | — | 200 `CandidateListItem[]` |
| GET /api/candidates/:id | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | — | 200 `Candidate` |
| PATCH /api/candidates/:id | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | `UpdateCandidateRequest` | 200 `Candidate` |
| DELETE /api/candidates/:id | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | — | 204 |
| POST /api/candidates/:id/export | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | — | 200 `GeneratedResume` |
| GET /api/candidates/:id/exports | `COMPANY_ADMIN`\|`COMPANY_MEMBER` | — | 200 `GeneratedResume[]` |

Upload flow: `apps/api` receives the file → uploads the original to Cloudinary (`source_file_url`) → forwards the file buffer to `services/parser` `POST /parse` → receives `ParsedResume` → inserts `candidates` + child rows (`work_experience`, `education`, `certifications`, `projects`, `candidate_skills`) + a `parsed_resumes` audit row (`raw_json` = the full `ParsedResume`) → responds with the hydrated `Candidate`.

Export flow: load the candidate + its company's `Company` branding → render with `@react-pdf/renderer` (template in `apps/api/src/pdf/`) → upload the resulting PDF buffer to Cloudinary → insert `generated_resumes` row → respond with its URL.

### Admin (auth required, `SUPER_ADMIN` only)
| Method & path | Body | Response |
|---|---|---|
| GET /api/admin/companies | — | 200 `AdminCompanySummary[]` |
| GET /api/admin/companies/:id | — | 200 `AdminCompanySummary` |
| PATCH /api/admin/companies/:id/status | `UpdateCompanyStatusRequest` | 200 `AdminCompanySummary` |
| GET /api/admin/stats | — | 200 `PlatformStats` |

### Misc
| Method & path | Response |
|---|---|
| GET /api/health | 200 `{ status: "ok" }` |

## Parser service contract (`services/parser`, internal only)

Not exposed to the internet in production (called only by `apps/api` over an internal URL, e.g. `PARSER_SERVICE_URL`).

| Method & path | Body | Response |
|---|---|---|
| POST /parse | multipart `file` (`.pdf` or `.docx`) | 200 `ParsedResume` (shape below), or 422 `{ error: { message } }` if the file isn't parseable |
| GET /health | — | 200 `{ status: "ok" }` |

`ParsedResume` (see `packages/shared-types/src/parsedResume.ts` for the canonical TS shape — the Python service must produce JSON matching this exactly, field names included, e.g. `fullName` not `full_name`, `isCurrent` not `is_current`):

```jsonc
{
  "contact": { "fullName": "...", "email": "...", "phone": "...", "location": "..." },
  "summary": "...",
  "skills": [{ "skill": "Swift", "category": "Languages & Frameworks" }],
  "experience": [{ "company": "...", "title": "...", "startDate": "2023-08", "endDate": null, "isCurrent": true, "description": ["...", "..."] }],
  "education": [{ "institution": "...", "degree": "...", "field": "...", "startDate": "...", "endDate": "..." }],
  "certifications": [{ "name": "...", "issuer": "...", "date": "..." }],
  "projects": [{ "name": "...", "description": ["..."], "techStack": ["..."] }],
  "meta": { "parserVersion": "0.1.0", "sourceFileType": "pdf", "warnings": [] }
}
```

## Parsing pipeline design (`services/parser`)

Hybrid, non-LLM pipeline (see plan/root research notes):

1. **Extract with layout metadata** — PDF via PyMuPDF (`fitz`): text spans with font size/bold/color/position. DOCX via `python-docx`: paragraphs with bold runs/style name.
2. **Section segmentation** — classify each line as a header via (a) fuzzy match against a known header keyword list (Summary, Skills, Experience/Professional Experience, Education, Certifications, Projects) or (b) font size/weight materially larger than surrounding body text. Text between two headers belongs to that section.
3. **Contact block** (text before the first detected section) — regex for email; `phonenumbers` for phone; spaCy `GPE`/`LOC` NER for location; name = largest-font line on page 1 (PDF) / first non-empty paragraph (DOCX), cross-checked against spaCy `PERSON` NER.
4. **Summary** — cleaned paragraph text of that section.
5. **Skills** — SkillNER (spaCy `PhraseMatcher` over the EMSI skills taxonomy) run on the Skills section (and the full doc as fallback); if the source used a category/detail table, preserve the category.
6. **Experience / Education / Certifications / Projects** — split section body into entries on a date-range regex (`Mon YYYY – Mon YYYY|Present`, and bare-year variants); first line = company+title or institution+degree; bullet/sub-lines = description array.
7. Assemble into the `ParsedResume` JSON above and return it. `meta.warnings` records anything the pipeline could not confidently extract (e.g. `"no email detected"`) so the reviewer's UI can flag it — the candidate profile is always human-editable after parsing, this pipeline is a starting point, not a final source of truth.

## White-label PDF template

`@react-pdf/renderer` document, built from a `Candidate` + its `Company` branding:
- Header band: `logoUrl` (Cloudinary image), `themeColor` as the band background.
- Body: name, contact line, summary, skills (grouped by category if present), experience/education/projects/certifications, each as a consistently-styled section — regardless of how the original resume was formatted, output always follows this one layout.
- Footer: `footerText` (if set) and `"Prepared & Submitted By: {companyName}"`.
