let counter = 0;

export async function uploadResumeSource(): Promise<{ url: string; publicId: string }> {
  counter++;
  return { url: `https://cloudinary.test/source/${counter}`, publicId: `source-${counter}` };
}

export async function uploadGeneratedResume(
  _buffer: Buffer,
  candidateId: string
): Promise<{ url: string; publicId: string }> {
  // Stable per-candidate URL (mirrors the real client's overwrite-in-place
  // behavior) — re-exporting the same candidate must resolve to the same
  // URL, not a new one, so tests can assert on that.
  return { url: `https://cloudinary.test/generated/${candidateId}`, publicId: `generated-${candidateId}` };
}

export async function uploadCompanyLogo(_buffer: Buffer, companyId: string): Promise<{ url: string; publicId: string }> {
  return { url: `https://cloudinary.test/logo/${companyId}`, publicId: `logo-${companyId}` };
}

export async function deleteAsset(): Promise<void> {
  return;
}
