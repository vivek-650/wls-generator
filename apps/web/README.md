# apps/web

Next.js 14 (App Router) + TypeScript + Tailwind frontend for the White Label Resume Generator.

Talks exclusively to `apps/api` (never to the parser service or DB directly) through the typed
wrapper in `lib/apiClient.ts`, using request/response types from `@wlr/shared-types`.

## Setup

```bash
npm install            # from the repo root (npm workspaces)
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace=apps/web
```

The app runs on http://localhost:3000 and expects the API at `NEXT_PUBLIC_API_URL`
(default `http://localhost:4000/api`).

## Structure

- `app/` — routes (App Router). `dashboard/*` is the company area, `admin/*` is the
  platform Super Admin area. Each has its own layout with a role-gated guard component.
- `components/` — shared UI: form inputs, route guards, nav sidebars, and the candidate
  section editors under `components/candidate/`.
- `lib/apiClient.ts` — the only place `fetch` is called. Attaches the in-memory access
  token, retries once on 401 via `POST /auth/refresh`, then triggers logout.
- `lib/auth-context.tsx` — React context holding `user` and `accessToken` in memory only
  (never localStorage/sessionStorage). Silently refreshes on mount using the httpOnly
  refresh-token cookie.

## Auth & routing rules

- Unauthenticated users hitting `/dashboard/*` or `/admin/*` are redirected to `/login`.
- `SUPER_ADMIN` hitting `/dashboard/*` is redirected to `/admin`, and any company user
  hitting `/admin/*` is redirected to `/dashboard`.
- `COMPANY_MEMBER` hitting `/dashboard/branding` or `/dashboard/team` is redirected to
  `/dashboard`.
