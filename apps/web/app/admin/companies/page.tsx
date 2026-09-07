"use client";

import { ErrorBanner } from "@/components/Banner";
import { SecondaryButton } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { ApiError, adminApi } from "@/lib/apiClient";
import type { AdminCompanySummary, CompanyStatus } from "@wlr/shared-types";
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
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Companies</h1>
        <p className="mt-1 text-sm text-gray-500">Activate or deactivate companies on the platform.</p>
      </div>

      <div className="mt-6">
        {error && <ErrorBanner message={error} />}

        {!error && companies === null && (
          <div className="flex items-center gap-2 py-12 text-sm text-gray-500">
            <Spinner className="h-4 w-4" /> Loading companies...
          </div>
        )}

        {companies !== null && companies.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-500">
            No companies yet.
          </div>
        )}

        {companies !== null && companies.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Users
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Candidates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.userCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.candidateCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SecondaryButton onClick={() => toggleStatus(c)} disabled={updatingId === c.id}>
                        {updatingId === c.id
                          ? "Updating..."
                          : c.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
