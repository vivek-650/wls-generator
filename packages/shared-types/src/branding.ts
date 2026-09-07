import { CompanyStatus } from "./roles";

export interface CompanyBranding {
  companyName: string;
  logoUrl: string | null;
  themeColor: string;
  footerText: string | null;
}

export interface Company extends CompanyBranding {
  id: string;
  status: CompanyStatus;
  createdAt: string;
}

/** Payload for PATCH /company/branding (COMPANY_ADMIN only). */
export interface UpdateBrandingRequest {
  companyName: string;
  themeColor: string;
  footerText: string | null;
}
