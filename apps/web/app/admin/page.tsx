"use client";

import { ErrorBanner } from "@/components/Banner";
import { Spinner } from "@/components/Spinner";
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
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Platform overview</h1>
        <p className="mt-1 text-sm text-gray-500">Usage across all companies on the platform.</p>
      </div>

      <div className="mt-6">
        {error && <ErrorBanner message={error} />}
        {!error && !stats && (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
            <Spinner className="h-4 w-4" /> Loading stats...
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((card) => (
              <div key={card.key} className="rounded-lg border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{stats[card.key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
