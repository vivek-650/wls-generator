import { PoolClient } from "pg";
import {
  Candidate,
  CandidateCertification,
  CandidateEducation,
  CandidateExperience,
  CandidateListItem,
  CandidateProject,
  CandidateSkill,
  ParsedCertificationEntry,
  ParsedEducationEntry,
  ParsedExperienceEntry,
  ParsedProjectEntry,
  ParsedSkill,
  SourceFileType,
} from "@wlr/shared-types";
import { pool } from "../db/pool";
import { CompanyScope } from "./withCompanyScope";

interface CandidateRow {
  id: string;
  company_id: string;
  created_by: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  source_file_url: string | null;
  source_file_type: SourceFileType | null;
  created_at: Date;
  updated_at: Date;
}

interface WorkExperienceRow {
  id: string;
  company_name: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string[];
  sort_order: number;
}

interface EducationRow {
  id: string;
  institution: string | null;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
}

interface CertificationRow {
  id: string;
  name: string;
  issuer: string | null;
  date: string | null;
  sort_order: number;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string[];
  tech_stack: string[];
  sort_order: number;
}

interface SkillRow {
  id: string;
  skill: string;
  category: string | null;
}

function toExperience(row: WorkExperienceRow): CandidateExperience {
  return {
    id: row.id,
    company: row.company_name,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function toEducation(row: EducationRow): CandidateEducation {
  return {
    id: row.id,
    institution: row.institution,
    degree: row.degree,
    field: row.field,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  };
}

function toCertification(row: CertificationRow): CandidateCertification {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    date: row.date,
    sortOrder: row.sort_order,
  };
}

function toProject(row: ProjectRow): CandidateProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    techStack: row.tech_stack,
    sortOrder: row.sort_order,
  };
}

function toSkill(row: SkillRow): CandidateSkill {
  return { id: row.id, skill: row.skill, category: row.category };
}

async function hydrateCandidate(row: CandidateRow): Promise<Candidate> {
  const candidateId = row.id;
  const [experience, education, certifications, projects, skills] = await Promise.all([
    pool.query<WorkExperienceRow>(
      "select * from work_experience where candidate_id = $1 order by sort_order asc",
      [candidateId]
    ),
    pool.query<EducationRow>(
      "select * from education where candidate_id = $1 order by sort_order asc",
      [candidateId]
    ),
    pool.query<CertificationRow>(
      "select * from certifications where candidate_id = $1 order by sort_order asc",
      [candidateId]
    ),
    pool.query<ProjectRow>(
      "select * from projects where candidate_id = $1 order by sort_order asc",
      [candidateId]
    ),
    pool.query<SkillRow>("select * from candidate_skills where candidate_id = $1 order by id asc", [
      candidateId,
    ]),
  ]);

  return {
    id: row.id,
    companyId: row.company_id,
    createdBy: row.created_by,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    summary: row.summary,
    sourceFileUrl: row.source_file_url,
    sourceFileType: row.source_file_type,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    skills: skills.rows.map(toSkill),
    experience: experience.rows.map(toExperience),
    education: education.rows.map(toEducation),
    certifications: certifications.rows.map(toCertification),
    projects: projects.rows.map(toProject),
  };
}

export interface NewCandidateInput {
  createdBy: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  sourceFileUrl: string | null;
  sourceFileType: SourceFileType | null;
  skills: ParsedSkill[];
  experience: ParsedExperienceEntry[];
  education: ParsedEducationEntry[];
  certifications: ParsedCertificationEntry[];
  projects: ParsedProjectEntry[];
}

export async function insertCandidate(
  client: PoolClient,
  scope: CompanyScope,
  data: NewCandidateInput
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into candidates
       (company_id, created_by, full_name, email, phone, location, summary, source_file_url, source_file_type)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      scope.companyId,
      data.createdBy,
      data.fullName,
      data.email,
      data.phone,
      data.location,
      data.summary,
      data.sourceFileUrl,
      data.sourceFileType,
    ]
  );
  const candidateId = result.rows[0].id;

  await insertChildRows(client, candidateId, data);

  return candidateId;
}

async function insertChildRows(
  client: PoolClient,
  candidateId: string,
  data: Pick<NewCandidateInput, "experience" | "education" | "certifications" | "projects" | "skills">
): Promise<void> {
  for (let i = 0; i < data.experience.length; i++) {
    const e = data.experience[i];
    await client.query(
      `insert into work_experience (candidate_id, company_name, title, start_date, end_date, is_current, description, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [candidateId, e.company, e.title, e.startDate, e.endDate, e.isCurrent, e.description, i]
    );
  }

  for (let i = 0; i < data.education.length; i++) {
    const ed = data.education[i];
    await client.query(
      `insert into education (candidate_id, institution, degree, field, start_date, end_date, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [candidateId, ed.institution, ed.degree, ed.field, ed.startDate, ed.endDate, i]
    );
  }

  for (let i = 0; i < data.certifications.length; i++) {
    const c = data.certifications[i];
    await client.query(
      `insert into certifications (candidate_id, name, issuer, date, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [candidateId, c.name, c.issuer, c.date, i]
    );
  }

  for (let i = 0; i < data.projects.length; i++) {
    const p = data.projects[i];
    await client.query(
      `insert into projects (candidate_id, name, description, tech_stack, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [candidateId, p.name, p.description, p.techStack, i]
    );
  }

  for (const s of data.skills) {
    await client.query(`insert into candidate_skills (candidate_id, skill, category) values ($1, $2, $3)`, [
      candidateId,
      s.skill,
      s.category,
    ]);
  }
}

async function deleteChildRows(client: PoolClient, candidateId: string): Promise<void> {
  // Sequential, not Promise.all: these all share one PoolClient/connection
  // (they run inside the caller's transaction), and a single connection can
  // only process one query at a time.
  await client.query("delete from work_experience where candidate_id = $1", [candidateId]);
  await client.query("delete from education where candidate_id = $1", [candidateId]);
  await client.query("delete from certifications where candidate_id = $1", [candidateId]);
  await client.query("delete from projects where candidate_id = $1", [candidateId]);
  await client.query("delete from candidate_skills where candidate_id = $1", [candidateId]);
}

export async function listCandidates(scope: CompanyScope): Promise<CandidateListItem[]> {
  const result = await pool.query<{
    id: string;
    full_name: string;
    email: string | null;
    location: string | null;
    created_at: Date;
    skill_count: string;
  }>(
    `select c.id, c.full_name, c.email, c.location, c.created_at,
            count(cs.id) as skill_count
       from candidates c
       left join candidate_skills cs on cs.candidate_id = c.id
      where c.company_id = $1 and c.deleted_at is null
      group by c.id
      order by c.created_at desc`,
    [scope.companyId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    location: row.location,
    createdAt: row.created_at.toISOString(),
    skillCount: parseInt(row.skill_count, 10),
  }));
}

export async function getCandidateById(scope: CompanyScope, id: string): Promise<Candidate | null> {
  const result = await pool.query<CandidateRow>(
    `select * from candidates where id = $1 and company_id = $2 and deleted_at is null`,
    [id, scope.companyId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return hydrateCandidate(row);
}

/** Lightweight existence + ownership check without paying for the full hydration. */
export async function candidateExists(scope: CompanyScope, id: string): Promise<boolean> {
  const result = await pool.query(
    "select 1 from candidates where id = $1 and company_id = $2 and deleted_at is null",
    [id, scope.companyId]
  );
  return (result.rowCount ?? 0) > 0;
}

export interface UpdateCandidateInput {
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: ParsedSkill[];
  experience: ParsedExperienceEntry[];
  education: ParsedEducationEntry[];
  certifications: ParsedCertificationEntry[];
  projects: ParsedProjectEntry[];
}

export async function updateCandidate(
  client: PoolClient,
  scope: CompanyScope,
  id: string,
  data: UpdateCandidateInput
): Promise<boolean> {
  const result = await client.query(
    `update candidates
        set full_name = $1, email = $2, phone = $3, location = $4, summary = $5, updated_at = now()
      where id = $6 and company_id = $7 and deleted_at is null`,
    [data.fullName, data.email, data.phone, data.location, data.summary, id, scope.companyId]
  );
  if ((result.rowCount ?? 0) === 0) return false;

  await deleteChildRows(client, id);
  await insertChildRows(client, id, data);
  return true;
}

/**
 * Soft delete: marks the candidate as removed without touching the row (or
 * any child rows) so it's excluded from every read path above but still
 * recoverable/auditable in the database. Filtering `deleted_at is null`
 * makes this idempotent-safe — deleting an already-deleted (or
 * nonexistent) candidate returns false, same as a real DELETE would.
 */
export async function deleteCandidate(scope: CompanyScope, id: string): Promise<boolean> {
  const result = await pool.query(
    "update candidates set deleted_at = now() where id = $1 and company_id = $2 and deleted_at is null",
    [id, scope.companyId]
  );
  return (result.rowCount ?? 0) > 0;
}
