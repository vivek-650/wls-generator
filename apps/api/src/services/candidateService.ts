import { Candidate, CandidateListItem, GeneratedResume, UpdateCandidateRequest } from "@wlr/shared-types";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { pool } from "../db/pool";
import { AppError } from "../errors/AppError";
import { withCompanyScope } from "../repositories/withCompanyScope";
import {
  candidateExists,
  deleteCandidate as deleteCandidateRow,
  getCandidateById,
  insertCandidate,
  listCandidates as listCandidateRows,
  updateCandidate as updateCandidateRow,
} from "../repositories/candidateRepository";
import { insertParsedResumeAudit } from "../repositories/parsedResumeRepository";
import { getCompanyById } from "../repositories/companyRepository";
import {
  insertGeneratedResume,
  listGeneratedResumesForCandidate,
} from "../repositories/generatedResumeRepository";
import { deleteAsset, uploadGeneratedResume, uploadResumeSource } from "../clients/cloudinaryClient";
import { parseResume } from "../clients/parserClient";
import { ResumeDocument } from "@wlr/pdf-template";

export interface AuthenticatedUser {
  id: string;
  companyId: string | null;
  role: string;
}

export interface UploadFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function sourceFileTypeFromMimetype(mimetype: string, filename: string): "pdf" | "docx" {
  if (mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  return "docx";
}

export async function uploadCandidate(user: AuthenticatedUser, file: UploadFileInput): Promise<Candidate> {
  const scope = withCompanyScope(user.companyId);
  const sourceFileType = sourceFileTypeFromMimetype(file.mimetype, file.originalname);

  const uploadedSource = await uploadResumeSource(file.buffer, file.originalname);

  try {
    const parsed = await parseResume({
      buffer: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
    });

    const client = await pool.connect();
    let candidateId: string;
    try {
      await client.query("begin");
      candidateId = await insertCandidate(client, scope, {
        createdBy: user.id,
        fullName: parsed.contact.fullName ?? "Unknown Candidate",
        email: parsed.contact.email,
        phone: parsed.contact.phone,
        location: parsed.contact.location,
        summary: parsed.summary,
        sourceFileUrl: uploadedSource.url,
        sourceFileType,
        skills: parsed.skills,
        experience: parsed.experience,
        education: parsed.education,
        certifications: parsed.certifications,
        projects: parsed.projects,
      });
      await insertParsedResumeAudit(client, candidateId, parsed);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }

    const candidate = await getCandidateById(scope, candidateId);
    if (!candidate) {
      throw AppError.internal("Candidate was created but could not be re-read");
    }
    return candidate;
  } catch (err) {
    // Don't leave an orphaned Cloudinary upload behind on any failure downstream of it.
    await deleteAsset(uploadedSource.publicId, "raw");
    throw err;
  }
}

export async function listCandidates(user: AuthenticatedUser): Promise<CandidateListItem[]> {
  const scope = withCompanyScope(user.companyId);
  return listCandidateRows(scope);
}

export async function getCandidate(user: AuthenticatedUser, id: string): Promise<Candidate> {
  const scope = withCompanyScope(user.companyId);
  const candidate = await getCandidateById(scope, id);
  if (!candidate) {
    throw AppError.notFound("Candidate not found");
  }
  return candidate;
}

export async function updateCandidate(
  user: AuthenticatedUser,
  id: string,
  data: UpdateCandidateRequest
): Promise<Candidate> {
  const scope = withCompanyScope(user.companyId);

  const client = await pool.connect();
  let updated: boolean;
  try {
    await client.query("begin");
    updated = await updateCandidateRow(client, scope, id, data);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  if (!updated) {
    throw AppError.notFound("Candidate not found");
  }

  const candidate = await getCandidateById(scope, id);
  if (!candidate) {
    throw AppError.notFound("Candidate not found");
  }
  return candidate;
}

export async function deleteCandidate(user: AuthenticatedUser, id: string): Promise<void> {
  const scope = withCompanyScope(user.companyId);
  const deleted = await deleteCandidateRow(scope, id);
  if (!deleted) {
    throw AppError.notFound("Candidate not found");
  }
}

export async function exportCandidate(user: AuthenticatedUser, id: string): Promise<GeneratedResume> {
  const scope = withCompanyScope(user.companyId);

  const exists = await candidateExists(scope, id);
  if (!exists) {
    throw AppError.notFound("Candidate not found");
  }

  const candidate = await getCandidateById(scope, id);
  const company = await getCompanyById(scope.companyId);
  if (!candidate || !company) {
    throw AppError.notFound("Candidate not found");
  }

  const pdfBuffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(ResumeDocument, { candidate, company }) as any
  );

  const filename = `${candidate.fullName.replace(/\s+/g, "-").toLowerCase()}-${candidate.id}.pdf`;
  const uploaded = await uploadGeneratedResume(pdfBuffer, filename);

  return insertGeneratedResume(scope, candidate.id, uploaded.url);
}

export async function listExports(user: AuthenticatedUser, id: string): Promise<GeneratedResume[]> {
  const scope = withCompanyScope(user.companyId);
  const exists = await candidateExists(scope, id);
  if (!exists) {
    throw AppError.notFound("Candidate not found");
  }
  return listGeneratedResumesForCandidate(scope, id);
}
