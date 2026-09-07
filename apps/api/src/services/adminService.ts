import { AdminCompanyDetail, AdminCompanySummary, CompanyStatus, PlatformStats } from "@wlr/shared-types";
import { AppError } from "../errors/AppError";
import {
  getCompanySummaryById,
  getPlatformStats as getPlatformStatsRow,
  listCompanySummaries,
} from "../repositories/adminRepository";
import { listCandidates } from "../repositories/candidateRepository";
import { getCompanyById, updateCompanyStatus as updateCompanyStatusRow } from "../repositories/companyRepository";
import { listCompanyUsers } from "../repositories/userRepository";
import { withCompanyScope } from "../repositories/withCompanyScope";

export async function listCompanies(): Promise<AdminCompanySummary[]> {
  return listCompanySummaries();
}

/**
 * Full company profile for the admin company-detail page: the platform
 * summary (status/counts) plus the company's own branding profile and the
 * actual users/candidates belonging to it. Reuses the same company-scoped
 * repository functions the company's own dashboard uses
 * (`listCompanyUsers`, `listCandidates`) via `withCompanyScope(companyId)`
 * — a SUPER_ADMIN reads through the identical, already-audited scoping
 * path as a normal company user, just pointed at someone else's company
 * instead of their own.
 */
export async function getCompany(companyId: string): Promise<AdminCompanyDetail> {
  const summary = await getCompanySummaryById(companyId);
  if (!summary) {
    throw AppError.notFound("Company not found");
  }
  const company = await getCompanyById(companyId);
  if (!company) {
    throw AppError.notFound("Company not found");
  }

  const scope = withCompanyScope(companyId);
  const [users, candidates] = await Promise.all([listCompanyUsers(scope), listCandidates(scope)]);

  return {
    ...summary,
    logoUrl: company.logoUrl,
    themeColor: company.themeColor,
    footerText: company.footerText,
    users,
    candidates,
  };
}

export async function updateCompanyStatus(companyId: string, status: CompanyStatus): Promise<AdminCompanySummary> {
  const updated = await updateCompanyStatusRow(companyId, status);
  if (!updated) {
    throw AppError.notFound("Company not found");
  }
  const summary = await getCompanySummaryById(companyId);
  if (!summary) {
    throw AppError.notFound("Company not found");
  }
  return summary;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  return getPlatformStatsRow();
}
