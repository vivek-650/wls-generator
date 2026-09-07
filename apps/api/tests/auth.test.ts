import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { resetDb, uniqueEmail } from "./testHelpers";

const app = createApp();

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("auth: register -> login -> me", () => {
  const email = uniqueEmail("admin");
  const password = "correct-horse-battery";

  it("registers a new company + COMPANY_ADMIN user", async () => {
    const res = await request(app).post("/api/auth/register").send({
      companyName: "Acme Staffing",
      name: "Ada Admin",
      email,
      password,
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: email.toLowerCase(), role: "COMPANY_ADMIN" });
    expect(res.body.user.companyId).toEqual(expect.any(String));
    expect(typeof res.body.accessToken).toBe("string");

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toMatch(/refresh_token=/);
  });

  it("rejects duplicate registration email with 409", async () => {
    const res = await request(app).post("/api/auth/register").send({
      companyName: "Another Co",
      name: "Someone Else",
      email,
      password,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it("rejects registration with invalid payload (400)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      companyName: "",
      name: "X",
      email: "not-an-email",
      password: "short",
    });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("rejects login with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user on /me with a valid bearer token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const token = login.body.accessToken;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email.toLowerCase());
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects /me with a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token via /auth/refresh and issues a new access token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const cookies = login.headers["set-cookie"];

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");

    const newCookies = res.headers["set-cookie"];
    expect(newCookies).toBeDefined();
    // rotation must issue a *different* raw refresh token value in the new cookie
    expect(String(newCookies)).not.toBe(String(cookies));

    // the old refresh cookie must now be revoked (rotation) — reusing it should fail
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(reuse.status).toBe(401);

    // but the newly-issued cookie from rotation must still work
    const reuseNew = await request(app).post("/api/auth/refresh").set("Cookie", newCookies);
    expect(reuseNew.status).toBe(200);
  });

  it("logs out and clears the session", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const cookies = login.headers["set-cookie"];

    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", cookies);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/auth/refresh").set("Cookie", cookies);
    expect(refreshAfterLogout.status).toBe(401);
  });
});
