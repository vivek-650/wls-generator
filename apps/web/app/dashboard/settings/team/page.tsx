"use client";

import { ErrorBanner } from "@/components/Banner";
import { DangerButton, PrimaryButton, TextInput } from "@/components/FormField";
import { RequireCompanyAdmin } from "@/components/RequireCompanyAdmin";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, companyApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@wlr/shared-types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

function TeamPageInner() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);

  function loadUsers() {
    setLoadError(null);
    return companyApi
      .listUsers()
      .then(setUsers)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load team."));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const created = await companyApi.addUser({ name: name.trim(), email: email.trim(), password });
      setUsers((prev) => (prev ? [...prev, created] : [created]));
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to add teammate.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await companyApi.removeUser(id);
      setUsers((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to remove teammate.");
    } finally {
      setRemovingId(null);
    }
  }

  if (users === null && !loadError) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Settings
      </Link>

      <PageHeader title="Team" description="Manage the teammates who can upload and export candidates for your company." />

      <Card>
        <CardHeader title="Add teammate" />
        <CardBody>
          <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <TextInput
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label="Temporary password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="sm:col-span-3">
              {addError && (
                <div className="mb-3">
                  <ErrorBanner message={addError} />
                </div>
              )}
              <PrimaryButton type="submit" disabled={adding} className="w-full sm:w-auto">
                {adding && <Spinner className="h-4 w-4" />}
                {adding ? "Adding..." : "Add teammate"}
              </PrimaryButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            New teammates are added as members — they can upload and export candidates but cannot manage
            branding or the team.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Members" />
        <CardBody>
          {loadError && <ErrorBanner message={loadError} />}

          {!loadError && users !== null && (
            <ul className="divide-y divide-slate-100">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge tone={u.role === "COMPANY_ADMIN" ? "brand" : "neutral"}>
                      {u.role === "COMPANY_ADMIN" ? "Admin" : "Member"}
                    </StatusBadge>
                    {u.id !== currentUser?.id && u.role !== "COMPANY_ADMIN" && (
                      <DangerButton onClick={() => handleRemove(u.id)} disabled={removingId === u.id}>
                        {removingId === u.id ? "Removing..." : "Remove"}
                      </DangerButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequireCompanyAdmin>
      <TeamPageInner />
    </RequireCompanyAdmin>
  );
}
