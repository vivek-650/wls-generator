import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { resetDb, uniqueEmail } from "./testHelpers";

const app = createApp();

const superAdminEmail = uniqueEmail("superadmin");
const superAdminPassword = "super-secret-password";

let superAdminToken: string;
let companyAdminEmail: string;
let companyAdminPassword: string;
let companyId: string;

beforeAll(async () => {
  await resetDb();

  // There is no public route to create a SUPER_ADMIN (by design) — insert
  // directly, mirroring exactly what src/scripts/seedSuperAdmin.ts does.
  const passwordHash = await bcrypt.hash(superAdminPassword, 10);
  await pool.query(
    `insert into users (company_id, email, password_hash, name, role) values (null, $1, $2, 'Super Admin', 'SUPER_ADMIN')`,
    [superAdminEmail, passwordHash]
  );

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: superAdminEmail, password: superAdminPassword });
  expect(login.status).toBe(200);
  superAdminToken = login.body.accessToken;

  companyAdminEmail = uniqueEmail("company-admin");
  companyAdminPassword = "correct-horse-battery";
  const register = await request(app).post("/api/auth/register").send({
    companyName: "Deactivate Me Inc",
    name: "Company Admin",
    email: companyAdminEmail,
    password: companyAdminPassword,
  });
  companyId = register.body.user.companyId;
});

afterAll(async () => {
  await pool.end();
});

describe("admin: platform operations", () => {
  it("non-SUPER_ADMIN cannot access admin routes", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: companyAdminEmail, password: companyAdminPassword });
    const res = await request(app)
      .get("/api/admin/companies")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN lists all companies", async () => {
    const res = await request(app)
      .get("/api/admin/companies")
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((c: { id: string }) => c.id === companyId)).toBe(true);
  });

  it("SUPER_ADMIN fetches platform stats", async () => {
    const res = await request(app).get("/api/admin/stats").set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCompanies).toBeGreaterThanOrEqual(1);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
  });

  it("SUPER_ADMIN fetches full company detail with its users and candidates", async () => {
    const res = await request(app)
      .get(`/api/admin/companies/${companyId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(companyId);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.some((u: { email: string }) => u.email === companyAdminEmail)).toBe(true);
    expect(Array.isArray(res.body.candidates)).toBe(true);
  });

  it("returns 404 company detail for a nonexistent company", async () => {
    const res = await request(app)
      .get("/api/admin/companies/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("deactivates a company, then that company's COMPANY_ADMIN is rejected with 403 on the next request", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: companyAdminEmail, password: companyAdminPassword });
    const companyAdminToken = login.body.accessToken;

    // token still valid before deactivation
    const before = await request(app)
      .get("/api/company")
      .set("Authorization", `Bearer ${companyAdminToken}`);
    expect(before.status).toBe(200);

    const deactivate = await request(app)
      .patch(`/api/admin/companies/${companyId}/status`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ status: "inactive" });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.status).toBe("inactive");

    // same still-unexpired access token must now be rejected purely because the company is inactive
    const after = await request(app)
      .get("/api/company")
      .set("Authorization", `Bearer ${companyAdminToken}`);
    expect(after.status).toBe(403);

    // and a fresh login attempt must also be blocked
    const loginAfterDeactivation = await request(app)
      .post("/api/auth/login")
      .send({ email: companyAdminEmail, password: companyAdminPassword });
    expect(loginAfterDeactivation.status).toBe(403);
  });

  it("reactivating the company restores access", async () => {
    const reactivate = await request(app)
      .patch(`/api/admin/companies/${companyId}/status`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ status: "active" });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.status).toBe("active");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: companyAdminEmail, password: companyAdminPassword });
    expect(login.status).toBe(200);
  });
});
