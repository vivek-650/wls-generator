"use client";

import { useAuth } from "@/lib/auth-context";
import { FullPageSpinner } from "@/components/Spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "SUPER_ADMIN") {
      router.replace("/admin");
    } else {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  return <FullPageSpinner />;
}
