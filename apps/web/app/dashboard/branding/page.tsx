"use client";

import { ErrorBanner, SuccessBanner } from "@/components/Banner";
import { PrimaryButton, TextAreaField, TextInput } from "@/components/FormField";
import { RequireCompanyAdmin } from "@/components/RequireCompanyAdmin";
import { FullPageSpinner, Spinner } from "@/components/Spinner";
import { ApiError, companyApi } from "@/lib/apiClient";
import type { Company } from "@wlr/shared-types";
import Image from "next/image";
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
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isOnboarding ? "Set up your branding" : "Branding"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isOnboarding
            ? "One last step before your dashboard — this is how your company appears on every exported candidate resume. You can always change it later."
            : "Controls how exported candidate PDFs are branded for your company."}
        </p>
      </div>

      {loadError && <ErrorBanner message={loadError} />}

      {company && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">Logo</h2>
            <div className="mt-4 flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt="Company logo"
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
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
                  {uploadingLogo && <Spinner className="h-4 w-4" />}
                  {uploadingLogo ? "Uploading..." : "Upload logo"}
                </PrimaryButton>
                {logoError && (
                  <div className="mt-2">
                    <ErrorBanner message={logoError} />
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">Company details</h2>
            <div className="mt-4 space-y-4">
              <TextInput
                label="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">Theme color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900">Preview</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
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
                <div className="h-2 w-3/4 rounded bg-gray-200" />
                <div className="h-2 w-1/2 rounded bg-gray-200" />
                <div className="h-2 w-2/3 rounded bg-gray-200" />
              </div>
              {footerText && (
                <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                  {footerText}
                </div>
              )}
              <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
                Prepared &amp; Submitted By: {companyName || "Your Company"}
              </div>
            </div>
          </section>

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
