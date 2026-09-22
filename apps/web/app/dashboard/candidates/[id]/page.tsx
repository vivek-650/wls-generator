"use client";

import { ErrorBanner, WarningBanner } from "@/components/Banner";
import { CertificationsEditor } from "@/components/candidate/CertificationsEditor";
import { EducationEditor } from "@/components/candidate/EducationEditor";
import { ExperienceEditor } from "@/components/candidate/ExperienceEditor";
import { ProjectsEditor } from "@/components/candidate/ProjectsEditor";
import { SkillsEditor } from "@/components/candidate/SkillsEditor";
import { PrimaryButton, SecondaryButton, TextAreaField, TextInput } from "@/components/FormField";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
import { AlertTriangle, ArrowLeft, Download, RotateCw } from "lucide-react";
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

/**
 * The browser's own `download="..."` attribute only reliably controls the
 * saved filename for a same-origin link — for a cross-origin Cloudinary
 * URL (which this always is), most browsers instead use the filename the
 * server itself reports, which here is the long, UUID-keyed storage path
 * (`{candidateId}.pdf`, chosen so re-exporting overwrites the same asset
 * in place rather than accumulating a new file every time — see
 * cloudinaryClient.ts). Cloudinary's `fl_attachment:<name>` delivery
 * transformation is the actual fix: it makes Cloudinary set the
 * Content-Disposition header itself, which every browser honors
 * regardless of origin. Inserted right after `/upload/`, the same
 * insertion point `packages/pdf-template`'s `toPdfSafeImageUrl` already
 * uses for its own delivery-URL transformation.
 */
function withAttachmentFilename(url: string, filename: string): string {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const insertAt = idx + marker.length;
  const nameWithoutExtension = filename.replace(/\.pdf$/i, "");
  // Cloudinary parses its own transformation syntax out of this segment —
  // "." and "," are structural delimiters there (not just filename
  // characters), so a name like "Dr. Hannah Chen" (period surviving the
  // earlier whitespace-to-hyphen pass) broke the whole delivery URL with
  // an HTTP 400 in practice. Percent-encoding doesn't help (Cloudinary
  // reads the raw transformation string, not a decoded one); stripping
  // anything but letters/digits/hyphen/underscore does.
  const safeName = nameWithoutExtension.replace(/[^A-Za-z0-9_-]/g, "") || "resume";
  return `${url.slice(0, insertAt)}fl_attachment:${safeName}/${url.slice(insertAt)}`;
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

  // Company branding, needed only to render the live in-browser PDF preview.
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [candidate, currentExport, companyResult] = await Promise.all([
          candidatesApi.get(candidateId),
          candidatesApi.getExport(candidateId).catch(() => null),
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

        if (currentExport) {
          setLatestExport(currentExport);
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
      setLatestExport(resume);
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
      setLatestExport(resume);
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
        <p className="text-base font-medium text-slate-900">Candidate not found</p>
        <SecondaryButton className="mt-4" onClick={() => router.push("/dashboard")}>
          Back to candidates
        </SecondaryButton>
      </div>
    );
  }

  const downloadName = `${(fullName || "resume").replace(/\s+/g, "-")}-resume.pdf`;
  const downloadUrl = latestExport ? withAttachmentFilename(latestExport.pdfUrl, downloadName) : "";
  const linkClasses =
    "inline-flex items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className={`mx-auto space-y-5 pb-16 ${viewMode === "preview" ? "max-w-5xl" : "max-w-3xl"}`}>
      <div>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to candidates
        </button>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{fullName || "Untitled candidate"}</h1>
      </div>

      {loadError && <ErrorBanner message={loadError} />}

      {viewMode === "preview" && latestExport ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">This is the resume your client will receive</p>
              <p className="text-xs text-slate-500">
                Last generated {new Date(latestExport.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={downloadName} className={linkClasses}>
                <Download className="h-4 w-4" aria-hidden="true" /> Download
              </a>
              <SecondaryButton onClick={handleRegenerate} disabled={exporting}>
                {exporting ? <Spinner className="h-4 w-4" /> : <RotateCw className="h-4 w-4" aria-hidden="true" />}
                {exporting ? "Regenerating..." : "Regenerate PDF"}
              </SecondaryButton>
              <PrimaryButton onClick={() => setViewMode("edit")}>Edit info</PrimaryButton>
            </div>
          </Card>

          {exportError && <ErrorBanner message={exportError} />}

          {warnings.length > 0 && (
            <button
              onClick={() => setViewMode("edit")}
              className="flex w-full items-center gap-2 border border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-800 hover:bg-amber-100"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {warnings.length} field{warnings.length === 1 ? "" : "s"} the parser flagged for review — click to
              edit
            </button>
          )}

          <div className="h-[85vh] overflow-hidden border border-slate-200 bg-slate-100">
            {company ? (
              <ResumePdfPreview candidate={buildPreviewCandidate()} company={company} />
            ) : (
              <FullPageSpinner />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {latestExport && (
            <button
              onClick={() => setViewMode("preview")}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to preview
            </button>
          )}

          <WarningBanner title="The parser flagged the following — please double-check:" items={warnings} />
          {saveExportError && <ErrorBanner message={saveExportError} />}

          <Card>
            <CardHeader title="Contact" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextInput label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Summary" />
            <CardBody>
              <TextAreaField
                label=""
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Professional summary..."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Skills" />
            <CardBody>
              <SkillsEditor value={skills} onChange={setSkills} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Experience" />
            <CardBody>
              <ExperienceEditor value={experience} onChange={setExperience} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Education" />
            <CardBody>
              <EducationEditor value={education} onChange={setEducation} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Certifications" />
            <CardBody>
              <CertificationsEditor value={certifications} onChange={setCertifications} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Projects" />
            <CardBody>
              <ProjectsEditor value={projects} onChange={setProjects} />
            </CardBody>
          </Card>

          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
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
