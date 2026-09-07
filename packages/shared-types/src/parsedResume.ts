/**
 * Contract returned by the Python parsing service (POST /parse) and persisted
 * verbatim into `parsed_resumes.raw_json`. The Express API maps this into the
 * normalized `candidates` + child tables.
 */

export type SourceFileType = "pdf" | "docx";

export interface ParsedContact {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface ParsedExperienceEntry {
  company: string | null;
  title: string | null;
  /** ISO "YYYY-MM" when confidently parsed, otherwise the raw source text. */
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string[];
}

export interface ParsedEducationEntry {
  institution: string | null;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ParsedCertificationEntry {
  name: string;
  issuer: string | null;
  date: string | null;
}

export interface ParsedProjectEntry {
  name: string;
  description: string[];
  techStack: string[];
}

export interface ParsedSkill {
  skill: string;
  category: string | null;
}

export interface ParsedResumeMeta {
  parserVersion: string;
  sourceFileType: SourceFileType;
  /** Non-fatal issues surfaced to the reviewer, e.g. "no email detected". */
  warnings: string[];
}

export interface ParsedResume {
  contact: ParsedContact;
  summary: string | null;
  skills: ParsedSkill[];
  experience: ParsedExperienceEntry[];
  education: ParsedEducationEntry[];
  certifications: ParsedCertificationEntry[];
  projects: ParsedProjectEntry[];
  meta: ParsedResumeMeta;
}
