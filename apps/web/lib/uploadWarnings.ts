/**
 * Transient, non-sensitive UX hint: the freshly-uploaded candidate's parser
 * warnings (Candidate itself carries no `meta` field per @wlr/shared-types —
 * only the raw ParsedResume the API persists internally does) are stashed
 * here right before navigating to the candidate detail page, then consumed
 * once on that page's first render. sessionStorage is fine for this — it is
 * not the access token and holds nothing sensitive.
 */
const KEY_PREFIX = "wlr:upload-warnings:";

export function stashUploadWarnings(candidateId: string, warnings: string[]): void {
  if (typeof window === "undefined" || warnings.length === 0) return;
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${candidateId}`, JSON.stringify(warnings));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export function consumeUploadWarnings(candidateId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = `${KEY_PREFIX}${candidateId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
