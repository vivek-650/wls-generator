import {
  ParsedCertificationEntry,
  ParsedEducationEntry,
  ParsedExperienceEntry,
  ParsedProjectEntry,
  ParsedSkill,
  SourceFileType,
} from "./parsedResume";

export interface CandidateExperience extends ParsedExperienceEntry {
  id: string;
  sortOrder: number;
}

export interface CandidateEducation extends ParsedEducationEntry {
  id: string;
  sortOrder: number;
}

export interface CandidateCertification extends ParsedCertificationEntry {
  id: string;
  sortOrder: number;
}

export interface CandidateProject extends ParsedProjectEntry {
  id: string;
  sortOrder: number;
}

export interface CandidateSkill extends ParsedSkill {
  id: string;
}

export interface Candidate {
  id: string;
  companyId: string;
  createdBy: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  sourceFileUrl: string | null;
  sourceFileType: SourceFileType | null;
  createdAt: string;
  updatedAt: string;
  skills: CandidateSkill[];
  experience: CandidateExperience[];
  education: CandidateEducation[];
  certifications: CandidateCertification[];
  projects: CandidateProject[];
}

/** Payload for PATCH /candidates/:id — full replace of the editable fields. */
export interface UpdateCandidateRequest {
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

export interface CandidateListItem {
  id: string;
  fullName: string;
  email: string | null;
  location: string | null;
  createdAt: string;
  skillCount: number;
}

export interface GeneratedResume {
  id: string;
  candidateId: string;
  companyId: string;
  pdfUrl: string;
  createdAt: string;
}
