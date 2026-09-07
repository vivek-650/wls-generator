import bcrypt from "bcrypt";
import { AuthUser, Company, UpdateBrandingRequest } from "@wlr/shared-types";
import { pool } from "../db/pool";
import { AppError } from "../errors/AppError";
import { withCompanyScope } from "../repositories/withCompanyScope";
import { getCompanyById, updateBranding as updateBrandingRow, updateLogoUrl } from "../repositories/companyRepository";
import {
  createUser,
  deleteCompanyUser,
  findUserByEmail,
  listCompanyUsers,
  toAuthUser,
} from "../repositories/userRepository";
import { uploadCompanyLogo } from "../clients/cloudinaryClient";
import { AuthenticatedUser } from "./candidateService";

export async function getCompany(user: AuthenticatedUser): Promise<Company> {
  const scope = withCompanyScope(user.companyId);
  const company = await getCompanyById(scope.companyId);
  if (!company) {
    throw AppError.notFound("Company not found");
  }
  return company;
}

export async function updateBranding(user: AuthenticatedUser, data: UpdateBrandingRequest): Promise<Company> {
  const scope = withCompanyScope(user.companyId);
  const company = await updateBrandingRow(scope.companyId, data);
  if (!company) {
    throw AppError.notFound("Company not found");
  }
  return company;
}

export async function uploadLogo(
  user: AuthenticatedUser,
  file: { buffer: Buffer }
): Promise<Company> {
  const scope = withCompanyScope(user.companyId);
  const uploaded = await uploadCompanyLogo(file.buffer, scope.companyId);
  const company = await updateLogoUrl(scope.companyId, uploaded.url);
  if (!company) {
    throw AppError.notFound("Company not found");
  }
  return company;
}

export async function listUsers(user: AuthenticatedUser): Promise<AuthUser[]> {
  const scope = withCompanyScope(user.companyId);
  return listCompanyUsers(scope);
}

export async function createCompanyUser(
  user: AuthenticatedUser,
  data: { name: string; email: string; password: string }
): Promise<AuthUser> {
  const scope = withCompanyScope(user.companyId);

  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const newUser = await createUser(client, {
      companyId: scope.companyId,
      email: data.email,
      passwordHash,
      name: data.name,
      role: "COMPANY_MEMBER",
    });
    await client.query("commit");
    return toAuthUser(newUser);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteUser(user: AuthenticatedUser, userId: string): Promise<void> {
  const scope = withCompanyScope(user.companyId);
  if (userId === user.id) {
    throw AppError.badRequest("You cannot remove your own account");
  }
  const deleted = await deleteCompanyUser(scope, userId);
  if (!deleted) {
    throw AppError.notFound("User not found");
  }
}
