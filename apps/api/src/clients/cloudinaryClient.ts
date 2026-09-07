import { v2 as cloudinary, UploadApiOptions } from "cloudinary";
import { env } from "../config/env";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  configured = true;
}

export interface UploadResult {
  url: string;
  publicId: string;
}

function uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadResult> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Cloudinary upload failed with no result"));
        return;
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

/**
 * Original resume uploads (pdf/docx) — stored as 'raw' since they aren't
 * images. The extension is kept *in* the public_id deliberately: Cloudinary
 * uses a 'raw' resource's public_id verbatim as the tail of its delivery
 * URL (unlike 'image', it doesn't infer/append a format from upload
 * metadata), so stripping it here produced extension-less URLs — browsers
 * then saved downloads with no file extension at all (no ".pdf"), which is
 * exactly what broke opening them locally.
 */
export function uploadResumeSource(buffer: Buffer, filename: string): Promise<UploadResult> {
  return uploadBuffer(buffer, {
    resource_type: "raw",
    folder: "wlr/resumes/sources",
    public_id: filename,
    use_filename: true,
    unique_filename: true,
  });
}

/**
 * Generated white-label PDF exports — 'raw', same extension-in-public_id
 * reasoning as `uploadResumeSource`. Keyed by candidate id (not filename)
 * and always overwritten in place: a candidate has at most one *current*
 * generated resume, so re-exporting (including every "Edit info" save)
 * replaces the same Cloudinary asset — same URL, new content — instead of
 * accumulating a new file on every export. Mirrors `uploadCompanyLogo`
 * below, which does the same for company logos.
 */
export function uploadGeneratedResume(buffer: Buffer, candidateId: string): Promise<UploadResult> {
  return uploadBuffer(buffer, {
    resource_type: "raw",
    folder: "wlr/resumes/generated",
    public_id: `${candidateId}.pdf`,
    overwrite: true,
    invalidate: true,
  });
}

/** Company logos — image resource type so Cloudinary can transform/optimize them. */
export function uploadCompanyLogo(buffer: Buffer, companyId: string): Promise<UploadResult> {
  return uploadBuffer(buffer, {
    resource_type: "image",
    folder: "wlr/logos",
    public_id: companyId,
    overwrite: true,
    invalidate: true,
  });
}

export async function deleteAsset(publicId: string, resourceType: "raw" | "image"): Promise<void> {
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    // best-effort cleanup — log and swallow so a cleanup failure doesn't mask the original error
    console.error(`Failed to clean up Cloudinary asset ${publicId}:`, err);
  }
}
