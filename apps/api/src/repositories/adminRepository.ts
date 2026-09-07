import { AdminCompanySummary, CompanyStatus, PlatformStats } from "@wlr/shared-types";
import { pool } from "../db/pool";

interface CompanySummaryRow {
  id: string;
  name: string;
  status: CompanyStatus;
  created_at: Date;
  user_count: string;
  candidate_count: string;
}

function toSummary(row: CompanySummaryRow): AdminCompanySummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    userCount: parseInt(row.user_count, 10),
    candidateCount: parseInt(row.candidate_count, 10),
    createdAt: row.created_at.toISOString(),
  };
}

const SUMMARY_QUERY = `
  select c.id, c.name, c.status, c.created_at,
         count(distinct u.id) as user_count,
         count(distinct cand.id) as candidate_count
    from companies c
    left join users u on u.company_id = c.id
    left join candidates cand on cand.company_id = c.id
   group by c.id
`;

export async function listCompanySummaries(): Promise<AdminCompanySummary[]> {
  const result = await pool.query<CompanySummaryRow>(`${SUMMARY_QUERY} order by c.created_at desc`);
  return result.rows.map(toSummary);
}

export async function getCompanySummaryById(companyId: string): Promise<AdminCompanySummary | null> {
  const result = await pool.query<CompanySummaryRow>(
    `${SUMMARY_QUERY} having c.id = $1`,
    [companyId]
  );
  return result.rows[0] ? toSummary(result.rows[0]) : null;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const result = await pool.query<{
    total_companies: string;
    active_companies: string;
    total_users: string;
    total_candidates: string;
    total_generated_resumes: string;
  }>(`
    select
      (select count(*) from companies) as total_companies,
      (select count(*) from companies where status = 'active') as active_companies,
      (select count(*) from users) as total_users,
      (select count(*) from candidates) as total_candidates,
      (select count(*) from generated_resumes) as total_generated_resumes
  `);
  const row = result.rows[0];
  return {
    totalCompanies: parseInt(row.total_companies, 10),
    activeCompanies: parseInt(row.active_companies, 10),
    totalUsers: parseInt(row.total_users, 10),
    totalCandidates: parseInt(row.total_candidates, 10),
    totalGeneratedResumes: parseInt(row.total_generated_resumes, 10),
  };
}
