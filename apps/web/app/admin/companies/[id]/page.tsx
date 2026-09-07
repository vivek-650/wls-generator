"use client";

import { ErrorBanner } from "@/components/Banner";
import { SecondaryButton } from "@/components/FormField";
import { FullPageSpinner } from "@/components/Spinner";
import { ApiError, adminApi } from "@/lib/apiClient";
import type { AdminCompanyDetail } from "@wlr/shared-types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = params.id;

  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getCompany(companyId)
      .then((data) => {
        if (!cancelled) setCompany(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load company.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-lg font-medium text-gray-900">Company not found</p>
        <SecondaryButton className="mt-4" onClick={() => router.push("/admin/companies")}>
          Back to companies
        </SecondaryButton>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!company) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <button
          onClick={() => router.push("/admin/companies")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to companies
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={`${company.name} logo`}
              className="h-14 w-14 rounded-md border border-gray-200 object-contain"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-md text-lg font-semibold text-white"
              style={{ backgroundColor: company.themeColor }}
            >
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Created {new Date(company.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm text-gray-600">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              company.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {company.status}
          </span>
          <span>{company.userCount} users</span>
          <span>{company.candidateCount} candidates</span>
        </div>
      </div>

      {company.footerText && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <span className="font-medium text-gray-900">Footer text: </span>
          {company.footerText}
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-900">Users ({company.users.length})</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {company.users.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No users yet.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {company.users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.role === "COMPANY_ADMIN" ? "Admin" : "Member"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">
          Candidates ({company.candidates.length})
        </h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {company.candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No candidates yet.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Skills
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {company.candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {c.fullName || "Untitled candidate"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.location ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.skillCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
