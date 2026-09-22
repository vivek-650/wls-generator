"use client";

import { useAuth } from "@/lib/auth-context";
import { LandingPage } from "@/components/LandingPage";
import { FullPageSpinner } from "@/components/Spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return <FullPageSpinner />;
  }

  return <LandingPage />;
}
