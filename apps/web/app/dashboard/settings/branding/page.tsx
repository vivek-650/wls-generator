"use client";

import { ErrorBanner, SuccessBanner } from "@/components/Banner";
import { PrimaryButton, TextAreaField, TextInput } from "@/components/FormField";
import { RequireCompanyAdmin } from "@/components/RequireCompanyAdmin";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, companyApi } from "@/lib/apiClient";
import type { Company } from "@wlr/shared-types";
import { ArrowLeft, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function BrandingPageInner() {
  const router = useRouter();
  const isOnboarding = useSearchParams().get("onboarding") === "1";

  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [themeColor, setThemeColor] = useState("#2563eb");
  const [footerText, setFooterText] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    companyApi
      .get()
      .then((c) => {
        if (cancelled) return;
        setCompany(c);
        setCompanyName(c.companyName);
        setThemeColor(c.themeColor);
        setFooterText(c.footerText ?? "");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Failed to load branding.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await companyApi.updateBranding({
        companyName: companyName.trim(),
        themeColor,
        footerText: footerText.trim() || null,
      });
      setCompany(updated);
      setSaveSuccess(true);
      if (isOnboarding) {
        router.push("/dashboard");
        return;
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save branding.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const updated = await companyApi.uploadLogo(file);
      setCompany(updated);
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!company && !loadError) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      {!isOnboarding && (
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Settings
        </Link>
      )}

      <PageHeader
        title={isOnboarding ? "Set up your branding" : "Branding"}
        description={
          isOnboarding
            ? "One last step before your dashboard — this is how your company appears on every exported candidate resume. You can always change it later."
            : "Controls how exported candidate PDFs are branded for your company."
        }
      />

      {loadError && <ErrorBanner message={loadError} />}

      {company && (
        <>
          <Card>
            <CardHeader title="Logo" />
            <CardBody>
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50">
                  {company.logoUrl ? (
                    <Image
                      src={company.logoUrl}
                      alt="Company logo"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <PrimaryButton onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    )}
                    {uploadingLogo ? "Uploading..." : "Upload logo"}
                  </PrimaryButton>
                  {logoError && (
                    <div className="mt-2">
                      <ErrorBanner message={logoError} />
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Company details" />
            <CardBody className="space-y-4">
              <TextInput
                label="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">Theme color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-sm border border-slate-300"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-32 rounded-sm border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <TextAreaField
                label="Footer text"
                rows={2}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Optional footer note shown on exported resumes"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Preview" />
            <CardBody>
              <div className="overflow-hidden border border-slate-200">
                <div
                  className="flex items-center gap-3 px-4 py-3 text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {company.logoUrl && (
                    <Image
                      src={company.logoUrl}
                      alt="Logo preview"
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded bg-white object-contain p-0.5"
                    />
                  )}
                  <span className="font-medium">{companyName || "Your Company"}</span>
                </div>
                <div className="space-y-2 bg-white p-4">
                  <div className="h-2 w-3/4 rounded bg-slate-200" />
                  <div className="h-2 w-1/2 rounded bg-slate-200" />
                  <div className="h-2 w-2/3 rounded bg-slate-200" />
                </div>
                {footerText && (
                  <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    {footerText}
                  </div>
                )}
                <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                  Prepared &amp; Submitted By: {companyName || "Your Company"}
                </div>
              </div>
            </CardBody>
          </Card>

          {saveError && <ErrorBanner message={saveError} />}
          {saveSuccess && <SuccessBanner>Branding saved.</SuccessBanner>}

          <div className="flex justify-end">
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? "Saving..." : isOnboarding ? "Save & continue to dashboard" : "Save branding"}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

export default function BrandingPage() {
  return (
    <RequireCompanyAdmin>
      <BrandingPageInner />
    </RequireCompanyAdmin>
  );
}
