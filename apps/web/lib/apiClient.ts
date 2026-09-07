import type {
  AdminCompanySummary,
  AuthResponse,
  AuthUser,
  Candidate,
  CandidateListItem,
  Company,
  GeneratedResume,
  LoginRequest,
  PlatformStats,
  RegisterRequest,
  UpdateBrandingRequest,
  UpdateCandidateRequest,
  UpdateCompanyStatusRequest,
} from "@wlr/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * The access token lives only in memory. auth-context owns the React state
 * and mirrors it in here via setAccessToken so this module (which has no
 * access to React context) can attach it to every request.
 */
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Registered by auth-context; called when refresh fails so the app can log the user out. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

interface ErrorBody {
  error?: { message?: string; code?: string };
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return {};
  }
}

/** Raw call to POST /auth/refresh — bypasses the normal 401-retry wrapper to avoid recursion. */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = (await res.json()) as { accessToken: string };
    accessToken = data.accessToken;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isForm?: boolean;
  /** internal: prevents infinite retry loops */
  _isRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, isForm = false, _isRetry = false } = options;

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!isForm && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, { ...options, _isRetry: true });
    }
    if (onSessionExpired) onSessionExpired();
    const errBody = await parseErrorBody(res);
    throw new ApiError(errBody.error?.message ?? "Session expired", 401, errBody.error?.code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const errBody = await parseErrorBody(res);
    if (res.status === 401 && onSessionExpired) onSessionExpired();
    throw new ApiError(
      errBody.error?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errBody.error?.code
    );
  }

  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Typed API surface — every request/response type comes from @wlr/shared-types
// ---------------------------------------------------------------------------

export const authApi = {
  register: (data: RegisterRequest) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: data }),
  login: (data: LoginRequest) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: data }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/auth/me"),
};

export const companyApi = {
  get: () => request<Company>("/company"),
  updateBranding: (data: UpdateBrandingRequest) =>
    request<Company>("/company/branding", { method: "PATCH", body: data }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return request<Company>("/company/logo", { method: "POST", body: form, isForm: true });
  },
  listUsers: () => request<AuthUser[]>("/company/users"),
  addUser: (data: { name: string; email: string; password: string }) =>
    request<AuthUser>("/company/users", { method: "POST", body: data }),
  removeUser: (id: string) => request<void>(`/company/users/${id}`, { method: "DELETE" }),
};

export const candidatesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Candidate>("/candidates/upload", { method: "POST", body: form, isForm: true });
  },
  list: () => request<CandidateListItem[]>("/candidates"),
  get: (id: string) => request<Candidate>(`/candidates/${id}`),
  update: (id: string, data: UpdateCandidateRequest) =>
    request<Candidate>(`/candidates/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) => request<void>(`/candidates/${id}`, { method: "DELETE" }),
  export: (id: string) =>
    request<GeneratedResume>(`/candidates/${id}/export`, { method: "POST" }),
  listExports: (id: string) => request<GeneratedResume[]>(`/candidates/${id}/exports`),
};

export const adminApi = {
  listCompanies: () => request<AdminCompanySummary[]>("/admin/companies"),
  getCompany: (id: string) => request<AdminCompanySummary>(`/admin/companies/${id}`),
  updateCompanyStatus: (id: string, data: UpdateCompanyStatusRequest) =>
    request<AdminCompanySummary>(`/admin/companies/${id}/status`, {
      method: "PATCH",
      body: data,
    }),
  stats: () => request<PlatformStats>("/admin/stats"),
};
