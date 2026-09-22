import { SearchResult } from "@wlr/shared-types";
import { searchCandidates } from "../repositories/candidateRepository";
import { searchCompanies } from "../repositories/adminRepository";
import { withCompanyScope } from "../repositories/withCompanyScope";
import { AuthenticatedUser } from "./candidateService";

/**
 * Dispatches by role, same as everywhere else scoping matters in this app:
 * company users (Admin/Member) search their own candidates; SUPER_ADMIN
 * searches companies platform-wide. There's no shared "search everything"
 * index — each role only ever searches the one domain it actually has
 * access to.
 */
export async function search(user: AuthenticatedUser, query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (user.role === "SUPER_ADMIN") {
    const companies = await searchCompanies(trimmed);
    return companies.map((c) => ({
      type: "company" as const,
      id: c.id,
      title: c.name,
      subtitle: null,
      href: `/admin/companies/${c.id}`,
    }));
  }

  const scope = withCompanyScope(user.companyId);
  const candidates = await searchCandidates(scope, trimmed);
  return candidates.map((c) => ({
    type: "candidate" as const,
    id: c.id,
    title: c.full_name,
    subtitle: c.email,
    href: `/dashboard/candidates/${c.id}`,
  }));
}
