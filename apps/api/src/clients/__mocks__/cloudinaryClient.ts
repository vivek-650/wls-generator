let counter = 0;

export async function uploadResumeSource(): Promise<{ url: string; publicId: string }> {
  counter++;
  return { url: `https://cloudinary.test/source/${counter}`, publicId: `source-${counter}` };
}

export async function uploadGeneratedResume(): Promise<{ url: string; publicId: string }> {
  counter++;
  return { url: `https://cloudinary.test/generated/${counter}`, publicId: `generated-${counter}` };
}

export async function uploadCompanyLogo(_buffer: Buffer, companyId: string): Promise<{ url: string; publicId: string }> {
  return { url: `https://cloudinary.test/logo/${companyId}`, publicId: `logo-${companyId}` };
}

export async function deleteAsset(): Promise<void> {
  return;
}
