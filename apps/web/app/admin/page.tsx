"use client";

import { ErrorBanner } from "@/components/Banner";
import { Spinner } from "@/components/Spinner";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, adminApi } from "@/lib/apiClient";
import type { PlatformStats } from "@wlr/shared-types";
import { useEffect, useState } from "react";

const cards: { key: keyof PlatformStats; label: string }[] = [
  { key: "totalCompanies", label: "Total companies" },
  { key: "activeCompanies", label: "Active companies" },
  { key: "totalUsers", label: "Total users" },
  { key: "totalCandidates", label: "Total candidates" },
  { key: "totalGeneratedResumes", label: "Resumes exported" },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .stats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load stats.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Platform overview" description="Usage across all companies on the platform." />

      {error && <ErrorBanner message={error} />}
      {!error && !stats && (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Loading stats...
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <Card key={card.key} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats[card.key]}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
