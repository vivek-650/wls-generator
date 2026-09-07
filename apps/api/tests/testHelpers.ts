import { env } from "../src/config/env";
import { pool } from "../src/db/pool";

const TABLES = [
  "generated_resumes",
  "parsed_resumes",
  "candidate_skills",
  "projects",
  "certifications",
  "education",
  "work_experience",
  "candidates",
  "refresh_tokens",
  "users",
  "companies",
];

// Hard safety guard, not just a documentation note: this suite truncates
// every table in beforeAll. DATABASE_URL is meant to be a local Postgres
// cluster while running tests, but `apps/api/.env` is *also* the file used
// for normal dev/prod runs against a real Supabase project — nothing
// stops a plain `npm test` from silently wiping real data if it happens to
// still be pointed at Supabase (this happened once for real). Refuse to
// truncate against anything that isn't unambiguously local.
function assertLocalDatabase(): void {
  const host = new URL(env.databaseUrl).hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocal) {
    throw new Error(
      `Refusing to run destructive tests against non-local DATABASE_URL host "${host}". ` +
        `These tests truncate every table. Point DATABASE_URL at a local Postgres instance ` +
        `(see apps/api/README.md "Local Postgres (dev + tests)") before running \`npm test\`, ` +
        `e.g.: DATABASE_URL=postgres://wlr:wlr@127.0.0.1:5544/wlr npm test --workspace=apps/api`
    );
  }
}

/** Wipes every app table so each test file starts from a clean slate against the shared local Postgres instance. */
export async function resetDb(): Promise<void> {
  assertLocalDatabase();
  await pool.query(`truncate table ${TABLES.join(", ")} restart identity cascade`);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

/**
 * A minimal, self-contained, valid PDF (one blank page — its content is
 * never actually parsed in these tests, since `parserClient` is mocked to
 * return a fixed canned result regardless of input). Deliberately not a
 * real resume file on disk: upload tests used to `.attach()` real personal
 * resumes from `samples/fixtures/`, which are `.gitignore`d and not
 * assumed to always be present (kept locally at the developer's
 * discretion) — that made the whole upload test suite fail whenever those
 * files weren't there, for a reason entirely unrelated to what's being
 * tested. Only the file's extension/mimetype are validated by the upload
 * route, so a synthetic buffer is exactly as good a fixture and always
 * available.
 */
export const MINIMAL_PDF_BUFFER = Buffer.from(
  "%PDF-1.1\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n",
  "utf-8"
);
