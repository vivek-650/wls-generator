import { CompanyStatus } from "./roles";

export interface AdminCompanySummary {
  id: string;
  name: string;
  status: CompanyStatus;
  userCount: number;
  candidateCount: number;
  createdAt: string;
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
