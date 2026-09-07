"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "./Spinner";

/**
 * Guards everything under /admin/*:
 * - no session -> /login
 * - any company role (COMPANY_ADMIN / COMPANY_MEMBER) -> /dashboard
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "SUPER_ADMIN") {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
