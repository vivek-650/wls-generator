"use client";

import { ErrorBanner, WarningBanner } from "@/components/Banner";
import { CertificationsEditor } from "@/components/candidate/CertificationsEditor";
import { EducationEditor } from "@/components/candidate/EducationEditor";
import { ExperienceEditor } from "@/components/candidate/ExperienceEditor";
import { ProjectsEditor } from "@/components/candidate/ProjectsEditor";
import { SkillsEditor } from "@/components/candidate/SkillsEditor";
import { PrimaryButton, SecondaryButton, TextAreaField, TextInput } from "@/components/FormField";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { ApiError, candidatesApi, companyApi } from "@/lib/apiClient";
import { consumeUploadWarnings } from "@/lib/uploadWarnings";
import type {
  Candidate,
  Company,
  GeneratedResume,
  ParsedCertificationEntry,
  ParsedEducationEntry,
  ParsedExperienceEntry,
  ParsedProjectEntry,
  ParsedResumeMeta,
  ParsedSkill,
  UpdateCandidateRequest,
} from "@wlr/shared-types";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// @react-pdf/renderer's PDFViewer touches browser-only APIs at import time —
// it must never be evaluated during Next.js's server render.
const ResumePdfPreview = dynamic(
  () => import("@/components/candidate/ResumePdfPreview").then((m) => m.ResumePdfPreview),
  { ssr: false, loading: () => <FullPageSpinner /> }
);

type CandidateWithMeta = Candidate & { meta?: ParsedResumeMeta };

function toExperience(list: Candidate["experience"]): ParsedExperienceEntry[] {
  return [...list]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      description: e.description,
    }));
}

function toEducation(list: Candidate["education"]): ParsedEducationEntry[] {
  return [...list]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startDate: e.startDate,
      endDate: e.endDate,
    }));
}

function toCertifications(list: Candidate["certifications"]): ParsedCertificationEntry[] {
  return [...list]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({ name: e.name, issuer: e.issuer, date: e.date }));
}

function toProjects(list: Candidate["projects"]): ParsedProjectEntry[] {
  return [...list]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({ name: e.name, description: e.description, techStack: e.techStack }));
}

function toSkills(list: Candidate["skills"]): ParsedSkill[] {
  return list.map((s) => ({ skill: s.skill, category: s.category }));
}

/** Drops blank lines a textarea's split("\n") can leave in a bullet list. */
function cleanLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean);
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const candidateId = params.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<ParsedSkill[]>([]);
  const [experience, setExperience] = useState<ParsedExperienceEntry[]>([]);
  const [education, setEducation] = useState<ParsedEducationEntry[]>([]);
  const [certifications, setCertifications] = useState<ParsedCertificationEntry[]>([]);
  const [projects, setProjects] = useState<ParsedProjectEntry[]>([]);

  const [viewMode, setViewMode] = useState<"preview" | "edit">("edit");

  const [saveExportError, setSaveExportError] = useState<string | null>(null);
  const [saveExportStage, setSaveExportStage] = useState<"" | "saving" | "generating">("");
  const busy = saveExportStage !== "";

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [latestExport, setLatestExport] = useState<GeneratedResume | null>(null);
  const [priorExports, setPriorExports] = useState<GeneratedResume[]>([]);

  // Company branding, needed only to render the live in-browser PDF preview.
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [candidate, exports, companyResult] = await Promise.all([
          candidatesApi.get(candidateId),
          candidatesApi.listExports(candidateId).catch(() => [] as GeneratedResume[]),
          companyApi.get().catch(() => null),
        ]);
        if (cancelled) return;
        setCompany(companyResult);

        const c = candidate as CandidateWithMeta;
        setFullName(c.fullName ?? "");
        setEmail(c.email ?? "");
        setPhone(c.phone ?? "");
        setLocation(c.location ?? "");
        setSummary(c.summary ?? "");
        setSkills(toSkills(c.skills));
        setExperience(toExperience(c.experience));
        setEducation(toEducation(c.education));
        setCertifications(toCertifications(c.certifications));
        setProjects(toProjects(c.projects));

        const stashed = consumeUploadWarnings(candidateId);
        const fromMeta = c.meta?.warnings ?? [];
        const merged = Array.from(new Set([...stashed, ...fromMeta]));
        setWarnings(merged);

        if (exports.length > 0) {
          const sorted = [...exports].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLatestExport(sorted[0]);
          setPriorExports(sorted.slice(1));
          // A resume already exists — that's the actual deliverable, so lead
          // with it rather than an edit form the user didn't ask to see.
          setViewMode("preview");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load candidate.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  function buildUpdatePayload(): UpdateCandidateRequest {
    return {
      fullName: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      location: location.trim() || null,
      summary: summary.trim() || null,
      skills,
      experience: experience.map((e) => ({ ...e, description: cleanLines(e.description) })),
      education,
      certifications,
      projects: projects.map((p) => ({ ...p, description: cleanLines(p.description) })),
    };
  }

  // The one primary action from the edit form: save the fields, then
  // immediately regenerate the PDF from them and switch back to the
  // preview — so "I changed something" and "I see the updated resume" are
  // a single step instead of two separate buttons a user has to remember
  // to press in order.
  async function handleSaveAndPreview() {
    setSaveExportError(null);
    setSaveExportStage("saving");
    try {
      const updated = await candidatesApi.update(candidateId, buildUpdatePayload());
      setFullName(updated.fullName ?? "");

      setSaveExportStage("generating");
      const resume = await candidatesApi.export(candidateId);
      setLatestExport((prev) => {
        if (prev) setPriorExports((p) => [prev, ...p]);
        return resume;
      });
      setViewMode("preview");
    } catch (err) {
      setSaveExportError(err instanceof ApiError ? err.message : "Failed to save and generate the PDF.");
    } finally {
      setSaveExportStage("");
    }
  }

  // Assembles a full `Candidate` from the currently-loaded form state, for
  // the live in-browser PDF preview (`ResumePdfPreview`). Fields the resume
  // template never reads (companyId, createdBy, timestamps, source file
  // info) are filled with harmless placeholders rather than left partial.
  function buildPreviewCandidate(): Candidate {
    return {
      id: candidateId,
      companyId: "",
      createdBy: "",
      fullName,
      email: email || null,
      phone: phone || null,
      location: location || null,
      summary: summary || null,
      sourceFileUrl: null,
      sourceFileType: null,
      createdAt: "",
      updatedAt: "",
      skills: skills.map((s, i) => ({ id: String(i), ...s })),
      experience: experience.map((e, i) => ({ id: String(i), sortOrder: i, ...e })),
      education: education.map((e, i) => ({ id: String(i), sortOrder: i, ...e })),
      certifications: certifications.map((c, i) => ({ id: String(i), sortOrder: i, ...c })),
      projects: projects.map((p, i) => ({ id: String(i), sortOrder: i, ...p })),
    };
  }

  // Re-render the PDF from the *already-saved* fields, with no edits — for
  // when only the company's branding changed and existing candidates just
  // need a refreshed export.
  async function handleRegenerate() {
    setExporting(true);
    setExportError(null);
    try {
      const resume = await candidatesApi.export(candidateId);
      setLatestExport((prev) => {
        if (prev) setPriorExports((p) => [prev, ...p]);
        return resume;
      });
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Failed to export resume.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-lg font-medium text-gray-900">Candidate not found</p>
        <SecondaryButton className="mt-4" onClick={() => router.push("/dashboard")}>
          Back to candidates
        </SecondaryButton>
      </div>
    );
  }

  const downloadName = `${(fullName || "resume").replace(/\s+/g, "-")}-resume.pdf`;
  const linkClasses =
    "inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50";

  return (
    <div className={`mx-auto space-y-6 pb-16 ${viewMode === "preview" ? "max-w-5xl" : "max-w-3xl"}`}>
      <div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to candidates
        </button>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          {fullName || "Untitled candidate"}
        </h1>
      </div>

      {loadError && <ErrorBanner message={loadError} />}

      {viewMode === "preview" && latestExport ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">This is the resume your client will receive</p>
              <p className="text-xs text-gray-500">
                Generated {new Date(latestExport.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={latestExport.pdfUrl} target="_blank" rel="noopener noreferrer" download={downloadName} className={linkClasses}>
                Download
              </a>
              <SecondaryButton onClick={handleRegenerate} disabled={exporting}>
                {exporting && <Spinner className="h-4 w-4" />}
                {exporting ? "Regenerating..." : "Regenerate PDF"}
              </SecondaryButton>
              <PrimaryButton onClick={() => setViewMode("edit")}>Edit info</PrimaryButton>
            </div>
          </div>

          {exportError && <ErrorBanner message={exportError} />}

          {warnings.length > 0 && (
            <button
              onClick={() => setViewMode("edit")}
              className="block w-full rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100"
            >
              ⚠ {warnings.length} field{warnings.length === 1 ? "" : "s"} the parser flagged for review — click to
              edit
            </button>
          )}

          <div className="h-[85vh] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            {company ? (
              <ResumePdfPreview candidate={buildPreviewCandidate()} company={company} />
            ) : (
              <FullPageSpinner />
            )}
          </div>

          {priorExports.length > 0 && (
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer select-none">
                Previous exports ({priorExports.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {priorExports.map((exp) => (
                  <li key={exp.id}>
                    <a
                      href={exp.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={downloadName}
                      className="break-all text-brand-600 underline hover:text-brand-700"
                    >
                      {new Date(exp.createdAt).toLocaleString()}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {latestExport && (
            <button
              onClick={() => setViewMode("preview")}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              ← Back to preview
            </button>
          )}

          <WarningBanner title="The parser flagged the following — please double-check:" items={warnings} />
          {saveExportError && <ErrorBanner message={saveExportError} />}

          <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Contact</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <TextInput label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextInput label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Summary</h2>
        <div className="mt-4">
          <TextAreaField
            label=""
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Professional summary..."
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Skills</h2>
        <div className="mt-4">
          <SkillsEditor value={skills} onChange={setSkills} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Experience</h2>
        <div className="mt-4">
          <ExperienceEditor value={experience} onChange={setExperience} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Education</h2>
        <div className="mt-4">
          <EducationEditor value={education} onChange={setEducation} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Certifications</h2>
        <div className="mt-4">
          <CertificationsEditor value={certifications} onChange={setCertifications} />
        </div>
      </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">Projects</h2>
            <div className="mt-4">
              <ProjectsEditor value={projects} onChange={setProjects} />
            </div>
          </section>

          <div className="flex justify-end gap-3">
            {latestExport && (
              <SecondaryButton onClick={() => setViewMode("preview")} disabled={busy}>
                Cancel
              </SecondaryButton>
            )}
            <PrimaryButton onClick={handleSaveAndPreview} disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              {saveExportStage === "saving" && "Saving..."}
              {saveExportStage === "generating" && "Generating PDF..."}
              {!busy && (latestExport ? "Save & update PDF" : "Save & generate PDF")}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
