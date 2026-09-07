import { GeneratedResume } from "@wlr/shared-types";
import { pool } from "../db/pool";
import { CompanyScope } from "./withCompanyScope";

interface GeneratedResumeRow {
  id: string;
  candidate_id: string;
  company_id: string;
  pdf_url: string;
  created_at: Date;
  updated_at: Date;
}

function toGeneratedResume(row: GeneratedResumeRow): GeneratedResume {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    companyId: row.company_id,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * A candidate has at most one *current* generated resume (see
 * `uploadGeneratedResume` in `clients/cloudinaryClient.ts`) — this upserts
 * that single row rather than inserting a new one per export, matching the
 * `generated_resumes_candidate_id_key` unique constraint from migration
 * 003. `created_at` is left untouched by the update clause so it still
 * reflects when the candidate's resume was *first* generated.
 */
export async function upsertGeneratedResume(
  scope: CompanyScope,
  candidateId: string,
  pdfUrl: string
): Promise<GeneratedResume> {
  const result = await pool.query<GeneratedResumeRow>(
    `insert into generated_resumes (candidate_id, company_id, pdf_url)
     values ($1, $2, $3)
     on conflict (candidate_id)
     do update set pdf_url = excluded.pdf_url, updated_at = now()
     returning *`,
    [candidateId, scope.companyId, pdfUrl]
  );
  return toGeneratedResume(result.rows[0]);
}

export async function getGeneratedResumeForCandidate(
  scope: CompanyScope,
  candidateId: string
): Promise<GeneratedResume | null> {
  const result = await pool.query<GeneratedResumeRow>(
    `select * from generated_resumes where candidate_id = $1 and company_id = $2`,
    [candidateId, scope.companyId]
  );
  return result.rows[0] ? toGeneratedResume(result.rows[0]) : null;
}
