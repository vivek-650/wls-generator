import { AdminCompanySummary, CompanyStatus, PlatformStats } from "@wlr/shared-types";
import { AppError } from "../errors/AppError";
import {
  getCompanySummaryById,
  getPlatformStats as getPlatformStatsRow,
  listCompanySummaries,
} from "../repositories/adminRepository";
import { updateCompanyStatus as updateCompanyStatusRow } from "../repositories/companyRepository";

export async function listCompanies(): Promise<AdminCompanySummary[]> {
  return listCompanySummaries();
}

export async function getCompany(companyId: string): Promise<AdminCompanySummary> {
  const company = await getCompanySummaryById(companyId);
  if (!company) {
    throw AppError.notFound("Company not found");
  }
  return company;
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
