"use client";

import type { AuthUser, LoginRequest, RegisterRequest } from "@wlr/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  authApi,
  refreshAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
} from "./apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** true only while the initial silent-refresh-on-mount is in flight */
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<AuthUser>;
  register: (data: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
  }, []);

  // Silent refresh on mount: the httpOnly refresh-token cookie (if any) lets
  // us restore a session without ever touching localStorage.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const newToken = await refreshAccessToken();
      if (cancelled) return;
      if (!newToken) {
        setIsLoading(false);
        return;
      }
      setToken(newToken);
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser(me);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    setAccessToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    setAccessToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort — clear local state regardless
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken: token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
