"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "./Spinner";

/**
 * Guards COMPANY_ADMIN-only pages (branding, team) nested under the already
 * DashboardGuard-wrapped dashboard layout. A COMPANY_MEMBER is bounced back
 * to /dashboard.
 */
export function RequireCompanyAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.role !== "COMPANY_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "COMPANY_ADMIN") {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
