"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { ResumeDocument } from "@wlr/pdf-template";
import type { Candidate, Company } from "@wlr/shared-types";

export interface ResumePdfPreviewProps {
  candidate: Candidate;
  company: Company;
}

/**
 * Renders the white-label resume PDF directly in the browser using the same
 * @react-pdf/renderer document (`ResumeDocument`, from `@wlr/pdf-template`)
 * the API uses to produce the real exported file — this is a true render of
 * the actual PDF pages, not a screenshot/approximation, and it's the exact
 * same template as every export, since both consume the same package.
 *
 * `PDFViewer` touches browser-only APIs at import time, so this component
 * must only ever be loaded via `next/dynamic(..., { ssr: false })`. Sizes
 * to 100% of its parent — control the visible box size on the wrapping
 * element instead of here.
 */
export function ResumePdfPreview({ candidate, company }: ResumePdfPreviewProps) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar={false}>
      <ResumeDocument candidate={candidate} company={company} />
    </PDFViewer>
  );
}
