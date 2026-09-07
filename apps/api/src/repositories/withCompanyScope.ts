/**
 * Every repository function that reads or writes a company-scoped table
 * (`candidates` and its child tables, `generated_resumes`, etc.) must accept
 * a `CompanyScope` — never a raw `companyId: string` — as its scoping
 * parameter. The only way to obtain one is `withCompanyScope(companyId)`,
 * which throws on an empty/undefined id. This makes it structurally
 * difficult to write a query that forgets the `company_id` filter: the
 * type system nudges every call site through this one function, and the
 * helper is the single place that would need editing to weaken isolation.
 *
 * Repository functions should use `scope.companyId` as the bound parameter
 * value and `scope.column` (default `"company_id"`) for tables where the
 * scoping column has a different name (none currently, but kept explicit
 * rather than hard-coding the string in every repository).
 */
export interface CompanyScope {
  readonly companyId: string;
  readonly column: string;
}

export function withCompanyScope(companyId: string | null | undefined, column = "company_id"): CompanyScope {
  if (!companyId || typeof companyId !== "string") {
    throw new Error("withCompanyScope() requires a non-empty companyId — refusing to build an unscoped query");
  }
  return Object.freeze({ companyId, column });
}
