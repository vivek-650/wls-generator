export type UserRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "COMPANY_MEMBER";

export type CompanyStatus = "active" | "inactive";

export const USER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "COMPANY_MEMBER",
];
