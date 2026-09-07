import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AccessTokenClaims, UserRole } from "@wlr/shared-types";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { getCompanyStatusById } from "../repositories/companyRepository";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Verifies the JWT access token and, for company users, checks that their
 * company is still `active` — a deactivated company must reject every one
 * of its non-SUPER_ADMIN users, and that check lives here (not per-route)
 * so it's impossible for a new route to forget it.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw AppError.unauthorized("Missing bearer token");
    }

    let claims: AccessTokenClaims;
    try {
      claims = jwt.verify(token, env.jwtSecret) as AccessTokenClaims;
    } catch {
      throw AppError.unauthorized("Invalid or expired access token");
    }

    if (claims.role !== "SUPER_ADMIN") {
      if (!claims.companyId) {
        throw AppError.unauthorized("Malformed access token");
      }
      const status = await getCompanyStatusById(claims.companyId);
      if (!status) {
        throw AppError.unauthorized("Company no longer exists");
      }
      if (status === "inactive") {
        throw AppError.forbidden("This company account has been deactivated", "COMPANY_INACTIVE");
      }
    }

    req.user = { id: claims.sub, companyId: claims.companyId, role: claims.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}
