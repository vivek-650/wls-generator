"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "./Spinner";

/**
 * Guards everything under /dashboard/*:
 * - no session -> /login
 * - SUPER_ADMIN -> /admin (that role has no access to the company dashboard)
 */
export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "SUPER_ADMIN") {
      router.replace("/admin");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === "SUPER_ADMIN") {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
