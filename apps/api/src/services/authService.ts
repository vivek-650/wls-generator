import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AccessTokenClaims, AuthUser, LoginRequest, RegisterRequest } from "@wlr/shared-types";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { AppError } from "../errors/AppError";
import { createCompany, getCompanyStatusById } from "../repositories/companyRepository";
import {
  createRefreshToken,
  findActiveRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenByHash,
} from "../repositories/refreshTokenRepository";
import { createUser, findUserByEmail, findUserById, toAuthUser, UserRow } from "../repositories/userRepository";
import { insertNotification } from "../repositories/notificationRepository";

const BCRYPT_ROUNDS = 10;

export interface TokenPair {
  authUser: AuthUser;
  accessToken: string;
  refreshToken: string; // raw token — caller sets as httpOnly cookie, never persisted raw
  refreshTokenExpiresAt: Date;
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function signAccessToken(user: UserRow): string {
  const claims: AccessTokenClaims = {
    sub: user.id,
    companyId: user.company_id,
    role: user.role,
  };
  return jwt.sign(claims, env.jwtSecret, { expiresIn: env.jwtAccessTtl } as jwt.SignOptions);
}

async function issueTokenPair(user: UserRow): Promise<TokenPair> {
  const accessToken = signAccessToken(user);

  const rawRefreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await createRefreshToken(user.id, tokenHash, expiresAt);

  return {
    authUser: toAuthUser(user),
    accessToken,
    refreshToken: rawRefreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function register(input: RegisterRequest): Promise<TokenPair> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const company = await createCompany(client, input.companyName);
    const user = await createUser(client, {
      companyId: company.id,
      email: input.email,
      passwordHash,
      name: input.name,
      role: "COMPANY_ADMIN",
    });
    await insertNotification(client, {
      companyId: null,
      type: "company_registered",
      title: `${input.companyName} registered`,
      link: `/admin/companies/${company.id}`,
    });
    await client.query("commit");
    return issueTokenPair(user);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function login(input: LoginRequest): Promise<TokenPair> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (user.role !== "SUPER_ADMIN") {
    const status = user.company_id ? await getCompanyStatusById(user.company_id) : null;
    if (!status || status === "inactive") {
      throw AppError.forbidden("This company account has been deactivated", "COMPANY_INACTIVE");
    }
  }

  return issueTokenPair(user);
}

export async function refresh(rawToken: string | undefined): Promise<TokenPair> {
  if (!rawToken) {
    throw AppError.unauthorized("Missing refresh token");
  }

  const tokenHash = hashRefreshToken(rawToken);
  const existing = await findActiveRefreshTokenByHash(tokenHash);
  if (!existing) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await findUserById(existing.user_id);
  if (!user) {
    await revokeRefreshToken(existing.id);
    throw AppError.unauthorized("User no longer exists");
  }

  if (user.role !== "SUPER_ADMIN") {
    const status = user.company_id ? await getCompanyStatusById(user.company_id) : null;
    if (!status || status === "inactive") {
      throw AppError.forbidden("This company account has been deactivated", "COMPANY_INACTIVE");
    }
  }

  // rotate: revoke the old row, issue a brand new one
  await revokeRefreshToken(existing.id);
  return issueTokenPair(user);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await revokeRefreshTokenByHash(tokenHash);
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw AppError.notFound("User not found");
  }
  return toAuthUser(user);
}
