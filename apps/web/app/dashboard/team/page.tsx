"use client";

import { ErrorBanner } from "@/components/Banner";
import { DangerButton, PrimaryButton, TextInput } from "@/components/FormField";
import { RequireCompanyAdmin } from "@/components/RequireCompanyAdmin";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { ApiError, companyApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@wlr/shared-types";
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the teammates who can upload and export candidates for your company.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Add teammate</h2>
        <form onSubmit={handleAdd} className="mt-4 grid grid-cols-3 gap-4">
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
          <div className="col-span-3">
            {addError && (
              <div className="mb-3">
                <ErrorBanner message={addError} />
              </div>
            )}
            <PrimaryButton type="submit" disabled={adding}>
              {adding && <Spinner className="h-4 w-4" />}
              {adding ? "Adding..." : "Add teammate"}
            </PrimaryButton>
          </div>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          New teammates are added as members — they can upload and export candidates but cannot
          manage branding or the team.
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Members</h2>

        {loadError && (
          <div className="mt-4">
            <ErrorBanner message={loadError} />
          </div>
        )}

        {!loadError && users === null && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" /> Loading team...
          </div>
        )}

        {users !== null && (
          <ul className="mt-4 divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {u.role === "COMPANY_ADMIN" ? "Admin" : "Member"}
                  </span>
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
      </section>
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
