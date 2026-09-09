import request from "supertest";

jest.mock("../src/clients/parserClient");
jest.mock("../src/clients/cloudinaryClient");

import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { MINIMAL_PDF_BUFFER, resetDb, uniqueEmail } from "./testHelpers";
import { SAMPLE_PARSED_RESUME } from "../src/clients/__mocks__/parserClient";
import * as parserClient from "../src/clients/parserClient";
import * as cloudinaryClient from "../src/clients/cloudinaryClient";

const app = createApp();

let accessToken: string;

beforeAll(async () => {
  await resetDb();

  const email = uniqueEmail("candidates-owner");
  const register = await request(app).post("/api/auth/register").send({
    companyName: "Candidate Co",
    name: "Owner Admin",
    email,
    password: "correct-horse-battery",
  });
  accessToken = register.body.accessToken;
});

afterAll(async () => {
  await pool.end();
});

describe("candidate upload + persist + edit + export flow", () => {
  let candidateId: string;

  it("uploads a resume and persists a hydrated candidate", async () => {
    const res = await request(app)
      .post("/api/candidates/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", MINIMAL_PDF_BUFFER, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe(SAMPLE_PARSED_RESUME.contact.fullName);
    expect(res.body.email).toBe(SAMPLE_PARSED_RESUME.contact.email);
    expect(res.body.skills).toHaveLength(SAMPLE_PARSED_RESUME.skills.length);
    expect(res.body.experience).toHaveLength(SAMPLE_PARSED_RESUME.experience.length);
    expect(res.body.sourceFileUrl).toMatch(/^https:\/\/cloudinary\.test\//);
    expect(res.body.id).toEqual(expect.any(String));

    candidateId = res.body.id;
  });

  it("rejects an upload with a disallowed file type", async () => {
    const res = await request(app)
      .post("/api/candidates/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("not a resume"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
  });

  it("propagates a 422 from the parser without leaving an orphaned candidate row", async () => {
    const { AppError } = await import("../src/errors/AppError");
    jest
      .spyOn(parserClient, "parseResume")
      .mockRejectedValueOnce(AppError.unprocessable("could not parse this file"));

    const before = await request(app)
      .get("/api/candidates")
      .set("Authorization", `Bearer ${accessToken}`);
    const countBefore = before.body.length;

    const res = await request(app)
      .post("/api/candidates/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", MINIMAL_PDF_BUFFER, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(422);

    const after = await request(app)
      .get("/api/candidates")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(after.body.length).toBe(countBefore);
  });

  it("rejects a non-resume upload before ever touching storage", async () => {
    const { AppError } = await import("../src/errors/AppError");
    jest
      .spyOn(parserClient, "parseResume")
      .mockRejectedValueOnce(AppError.unprocessable("This file doesn't look like a resume.", "NOT_A_RESUME"));
    const uploadSpy = jest.spyOn(cloudinaryClient, "uploadResumeSource");

    const res = await request(app)
      .post("/api/candidates/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", MINIMAL_PDF_BUFFER, { filename: "invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_A_RESUME");
    // The whole point of validating before storing: a rejected file must
    // never reach Cloudinary, not even transiently.
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("lists candidates for the company", async () => {
    const res = await request(app).get("/api/candidates").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: { id: string }) => c.id === candidateId)).toBe(true);
  });

  it("gets a single candidate by id", async () => {
    const res = await request(app)
      .get(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(candidateId);
  });

  it("returns 404 for a nonexistent candidate id", async () => {
    const res = await request(app)
      .get("/api/candidates/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it("updates a candidate with a full replace payload", async () => {
    const res = await request(app)
      .patch(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Jamie Rivera-Updated",
        email: "jamie.updated@example.com",
        phone: null,
        location: "Remote",
        summary: "Updated summary",
        skills: [{ skill: "Kotlin", category: "Languages & Frameworks" }],
        experience: [],
        education: [],
        certifications: [],
        projects: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Jamie Rivera-Updated");
    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].skill).toBe("Kotlin");
    expect(res.body.experience).toHaveLength(0);
  });

  it("exports a white-label PDF for the candidate", async () => {
    const res = await request(app)
      .post(`/api/candidates/${candidateId}/export`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.candidateId).toBe(candidateId);
    expect(res.body.pdfUrl).toMatch(/^https:\/\/cloudinary\.test\//);
  }, 30000);

  it("gets the current export for the candidate", async () => {
    const res = await request(app)
      .get(`/api/candidates/${candidateId}/export`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.candidateId).toBe(candidateId);
  });

  it("re-exporting overwrites the same PDF instead of creating a new one", async () => {
    const first = await request(app)
      .get(`/api/candidates/${candidateId}/export`)
      .set("Authorization", `Bearer ${accessToken}`);

    const second = await request(app)
      .post(`/api/candidates/${candidateId}/export`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(second.status).toBe(200);
    // Same Cloudinary URL — the asset was overwritten in place, not duplicated.
    expect(second.body.pdfUrl).toBe(first.body.pdfUrl);
    expect(second.body.id).toBe(first.body.id);

    const row = await pool.query("select count(*) from generated_resumes where candidate_id = $1", [
      candidateId,
    ]);
    expect(Number(row.rows[0].count)).toBe(1);
  }, 30000);

  it("soft-deletes a candidate: hidden from the API, still present in the database", async () => {
    const del = await request(app)
      .delete(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.status).toBe(404);

    const list = await request(app)
      .get("/api/candidates")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.some((c: { id: string }) => c.id === candidateId)).toBe(false);

    const row = await pool.query("select deleted_at from candidates where id = $1", [candidateId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].deleted_at).not.toBeNull();

    // Deleting an already-deleted candidate is a no-op 404, not a second delete.
    const redel = await request(app)
      .delete(`/api/candidates/${candidateId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(redel.status).toBe(404);
  });
});
