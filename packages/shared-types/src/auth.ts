import { UserRole } from "./roles";

export interface RegisterRequest {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

/** JWT access token payload. */
export interface AccessTokenClaims {
  sub: string; // userId
  companyId: string | null;
  role: UserRole;
}
