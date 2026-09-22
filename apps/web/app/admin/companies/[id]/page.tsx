"use client";

import { ErrorBanner } from "@/components/Banner";
import { SecondaryButton } from "@/components/FormField";
import { FullPageSpinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/Card";
import { ApiError, adminApi } from "@/lib/apiClient";
import type { AdminCompanyDetail } from "@wlr/shared-types";
import { ArrowLeft } from "lucide-react";
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
        <p className="text-base font-medium text-slate-900">Company not found</p>
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
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <button
        onClick={() => router.push("/admin/companies")}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to companies
      </button>

      <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={`${company.name} logo`}
              className="h-14 w-14 border border-slate-200 object-contain"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center text-lg font-semibold text-white"
              style={{ backgroundColor: company.themeColor }}
            >
              {company.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{company.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Created {new Date(company.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-sm text-slate-600">
          <StatusBadge tone={company.status === "active" ? "success" : "neutral"}>{company.status}</StatusBadge>
          <span>{company.userCount} users</span>
          <span>{company.candidateCount} candidates</span>
        </div>
      </Card>

      {company.footerText && (
        <Card className="p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Footer text: </span>
          {company.footerText}
        </Card>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Users ({company.users.length})</h2>
        <Card className="mt-2 overflow-x-auto">
          {company.users.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No users yet.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {company.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">{u.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{u.email}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {u.role === "COMPANY_ADMIN" ? "Admin" : "Member"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Candidates ({company.candidates.length})</h2>
        <Card className="mt-2 overflow-x-auto">
          {company.candidates.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No candidates yet.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Location
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Skills
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {company.candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                      {c.fullName || "Untitled candidate"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.email ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.location ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.skillCount}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}
