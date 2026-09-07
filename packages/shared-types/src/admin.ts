import { AuthUser } from "./auth";
import { CandidateListItem } from "./candidate";
import { CompanyStatus } from "./roles";

export interface AdminCompanySummary {
  id: string;
  name: string;
  status: CompanyStatus;
  userCount: number;
  candidateCount: number;
  createdAt: string;
}

/** GET /admin/companies/:id — the summary plus full company profile info
 * and the actual users/candidates belonging to it. */
export interface AdminCompanyDetail extends AdminCompanySummary {
  logoUrl: string | null;
  themeColor: string;
  footerText: string | null;
  users: AuthUser[];
  candidates: CandidateListItem[];
}

export interface UpdateCompanyStatusRequest {
  status: CompanyStatus;
}

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalCandidates: number;
  totalGeneratedResumes: number;
}
