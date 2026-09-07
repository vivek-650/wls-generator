import { GeneratedResume } from "@wlr/shared-types";
import { pool } from "../db/pool";
import { CompanyScope } from "./withCompanyScope";

interface GeneratedResumeRow {
  id: string;
  candidate_id: string;
  company_id: string;
  pdf_url: string;
  created_at: Date;
}

function toGeneratedResume(row: GeneratedResumeRow): GeneratedResume {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    companyId: row.company_id,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at.toISOString(),
  };
}

export async function insertGeneratedResume(
  scope: CompanyScope,
  candidateId: string,
  pdfUrl: string
): Promise<GeneratedResume> {
  const result = await pool.query<GeneratedResumeRow>(
    `insert into generated_resumes (candidate_id, company_id, pdf_url)
     values ($1, $2, $3)
     returning *`,
    [candidateId, scope.companyId, pdfUrl]
  );
  return toGeneratedResume(result.rows[0]);
}

export async function listGeneratedResumesForCandidate(
  scope: CompanyScope,
  candidateId: string
): Promise<GeneratedResume[]> {
  const result = await pool.query<GeneratedResumeRow>(
    `select * from generated_resumes where candidate_id = $1 and company_id = $2 order by created_at desc`,
    [candidateId, scope.companyId]
  );
  return result.rows.map(toGeneratedResume);
}
