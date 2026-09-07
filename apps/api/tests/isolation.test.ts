import request from "supertest";

jest.mock("../src/clients/parserClient");
jest.mock("../src/clients/cloudinaryClient");

import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { MINIMAL_PDF_BUFFER, resetDb, uniqueEmail } from "./testHelpers";

const app = createApp();

let tokenA: string;
let tokenB: string;
let candidateIdA: string;

beforeAll(async () => {
  await resetDb();

  const regA = await request(app).post("/api/auth/register").send({
    companyName: "Company A",
    name: "Admin A",
    email: uniqueEmail("company-a"),
    password: "correct-horse-battery",
  });
  tokenA = regA.body.accessToken;

  const regB = await request(app).post("/api/auth/register").send({
    companyName: "Company B",
    name: "Admin B",
    email: uniqueEmail("company-b"),
    password: "correct-horse-battery",
  });
  tokenB = regB.body.accessToken;

  const upload = await request(app)
    .post("/api/candidates/upload")
    .set("Authorization", `Bearer ${tokenA}`)
    .attach("file", MINIMAL_PDF_BUFFER, { filename: "resume.pdf", contentType: "application/pdf" });
  candidateIdA = upload.body.id;
});

afterAll(async () => {
  await pool.end();
});

describe("multi-tenant data isolation", () => {
  it("company B cannot read company A's candidate", async () => {
    const res = await request(app)
      .get(`/api/candidates/${candidateIdA}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect([403, 404]).toContain(res.status);
  });

  it("company B's candidate list never contains company A's candidate", async () => {
    const res = await request(app).get("/api/candidates").set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.find((c: { id: string }) => c.id === candidateIdA)).toBeUndefined();
  });

  it("company B cannot update company A's candidate", async () => {
    const res = await request(app)
      .patch(`/api/candidates/${candidateIdA}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        fullName: "Hijacked",
        email: null,
        phone: null,
        location: null,
        summary: null,
        skills: [],
        experience: [],
        education: [],
        certifications: [],
        projects: [],
      });
    expect([403, 404]).toContain(res.status);

    // confirm company A's data is untouched
    const stillA = await request(app)
      .get(`/api/candidates/${candidateIdA}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(stillA.body.fullName).not.toBe("Hijacked");
  });

  it("company B cannot delete company A's candidate", async () => {
    const res = await request(app)
      .delete(`/api/candidates/${candidateIdA}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect([403, 404]).toContain(res.status);

    const stillThere = await request(app)
      .get(`/api/candidates/${candidateIdA}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(stillThere.status).toBe(200);
  });

  it("company B cannot see company A's branding via /company", async () => {
    const resA = await request(app).get("/api/company").set("Authorization", `Bearer ${tokenA}`);
    const resB = await request(app).get("/api/company").set("Authorization", `Bearer ${tokenB}`);
    expect(resA.body.id).not.toBe(resB.body.id);
  });
});
