import { PoolClient } from "pg";
import { Company, CompanyStatus, UpdateBrandingRequest } from "@wlr/shared-types";
import { pool } from "../db/pool";

interface CompanyRow {
  id: string;
  name: string;
  logo_url: string | null;
  theme_color: string;
  footer_text: string | null;
  status: CompanyStatus;
  created_at: Date;
  updated_at: Date;
}

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    companyName: row.name,
    logoUrl: row.logo_url,
    themeColor: row.theme_color,
    footerText: row.footer_text,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

/** Used only by the auth middleware to check whether a request's company is active. Not company-scoped by design — it *establishes* the scope. */
export async function getCompanyStatusById(companyId: string): Promise<CompanyStatus | null> {
  const result = await pool.query<{ status: CompanyStatus }>(
    "select status from companies where id = $1",
    [companyId]
  );
  return result.rows[0]?.status ?? null;
}

export async function createCompany(client: PoolClient, name: string): Promise<Company> {
  const result = await client.query<CompanyRow>(
    `insert into companies (name) values ($1) returning *`,
    [name]
  );
  return toCompany(result.rows[0]);
}

/** A user may only ever fetch their own company — companyId comes from req.user.companyId, established by auth middleware. */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  const result = await pool.query<CompanyRow>("select * from companies where id = $1", [companyId]);
  return result.rows[0] ? toCompany(result.rows[0]) : null;
}

export async function updateBranding(companyId: string, data: UpdateBrandingRequest): Promise<Company | null> {
  const result = await pool.query<CompanyRow>(
    `update companies
       set name = $1, theme_color = $2, footer_text = $3, updated_at = now()
     where id = $4
     returning *`,
    [data.companyName, data.themeColor, data.footerText, companyId]
  );
  return result.rows[0] ? toCompany(result.rows[0]) : null;
}

export async function updateLogoUrl(companyId: string, logoUrl: string): Promise<Company | null> {
  const result = await pool.query<CompanyRow>(
    `update companies set logo_url = $1, updated_at = now() where id = $2 returning *`,
    [logoUrl, companyId]
  );
  return result.rows[0] ? toCompany(result.rows[0]) : null;
}

export async function updateCompanyStatus(companyId: string, status: CompanyStatus): Promise<Company | null> {
  const result = await pool.query<CompanyRow>(
    `update companies set status = $1, updated_at = now() where id = $2 returning *`,
    [status, companyId]
  );
  return result.rows[0] ? toCompany(result.rows[0]) : null;
}
