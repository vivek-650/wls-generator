"use client";

import { ErrorBanner } from "@/components/Banner";
import { SecondaryButton } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, adminApi } from "@/lib/apiClient";
import type { AdminCompanySummary, CompanyStatus } from "@wlr/shared-types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<AdminCompanySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load companies.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleStatus(company: AdminCompanySummary) {
    const nextStatus: CompanyStatus = company.status === "active" ? "inactive" : "active";
    setUpdatingId(company.id);
    setError(null);
    try {
      const updated = await adminApi.updateCompanyStatus(company.id, { status: nextStatus });
      setCompanies((prev) => (prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update company status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Companies" description="Activate or deactivate companies on the platform." />

      {error && <ErrorBanner message={error} />}

      {!error && companies === null && (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Loading companies...
        </div>
      )}

      {companies !== null && companies.length === 0 && (
        <Card className="border-dashed py-16 text-center text-sm text-slate-500">No companies yet.</Card>
      )}

      {companies !== null && companies.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Company
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Users
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Candidates
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                    <Link href={`/admin/companies/${c.id}`} className="text-brand-600 hover:text-brand-700">
                      {c.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <StatusBadge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</StatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.userCount}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.candidateCount}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <SecondaryButton onClick={() => toggleStatus(c)} disabled={updatingId === c.id}>
                      {updatingId === c.id ? "Updating..." : c.status === "active" ? "Deactivate" : "Activate"}
                    </SecondaryButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
