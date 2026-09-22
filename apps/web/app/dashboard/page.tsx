"use client";

import { ErrorBanner } from "@/components/Banner";
import { DangerButton, PrimaryButton } from "@/components/FormField";
import { Spinner } from "@/components/Spinner";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, candidatesApi } from "@/lib/apiClient";
import { stashUploadWarnings } from "@/lib/uploadWarnings";
import type { CandidateListItem, ParsedResumeMeta } from "@wlr/shared-types";
import { UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function CandidatesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [candidates, setCandidates] = useState<CandidateListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    candidatesApi
      .list()
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load candidates.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const candidate = await candidatesApi.upload(file);
      // The upload response is typed as Candidate, but the backend may attach
      // the parser's meta.warnings alongside it (see docs/architecture.md's
      // ParsedResume.meta) — read it defensively without widening the shared type.
      const meta = (candidate as { meta?: ParsedResumeMeta }).meta;
      if (meta?.warnings?.length) {
        stashUploadWarnings(candidate.id, meta.warnings);
      }
      router.push(`/dashboard/candidates/${candidate.id}`);
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : "Failed to parse resume. Please try again."
      );
      setUploading(false);
    }
  }

  async function handleRemove(candidate: CandidateListItem) {
    const confirmed = window.confirm(
      `Remove ${candidate.fullName || "this candidate"}? They'll no longer appear in your candidate list.`
    );
    if (!confirmed) return;

    setRemovingId(candidate.id);
    setLoadError(null);
    try {
      await candidatesApi.remove(candidate.id);
      setCandidates((prev) => (prev ? prev.filter((c) => c.id !== candidate.id) : prev));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to remove candidate.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Candidates"
        description="Upload a resume to parse it into an editable, brandable profile."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            <PrimaryButton onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
              {uploading ? <Spinner className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
              {uploading ? "Parsing resume..." : "Upload resume"}
            </PrimaryButton>
          </>
        }
      />

      {uploadError && <ErrorBanner message={uploadError} />}

      {loadError && <ErrorBanner message={loadError} />}

      {!loadError && candidates === null && (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Loading candidates...
        </div>
      )}

      {candidates !== null && candidates.length === 0 && (
        <Card className="border-dashed py-16 text-center text-sm text-slate-500">
          No candidates yet. Upload a resume to get started.
        </Card>
      )}

      {candidates !== null && candidates.length > 0 && (
        <Card className="overflow-x-auto">
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
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link
                      href={`/dashboard/candidates/${c.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {c.fullName || "Untitled candidate"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.email ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.location ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{c.skillCount}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <DangerButton onClick={() => handleRemove(c)} disabled={removingId === c.id}>
                      {removingId === c.id ? "Removing..." : "Remove"}
                    </DangerButton>
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
