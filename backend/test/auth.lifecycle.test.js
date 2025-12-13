import request from "supertest";
import app from "../src/app.js";
import { query, pool } from "../src/db/db.js";
import { extractCsrfToken } from "./helpers/csrf.js";
import { resetRateLimiters } from "../src/middleware/rate-limit.js";

const USERNAME = "lifecycle_user";
const EMAIL = "lifecycle@example.com";
const PASSWORD = "Secur3Pass!";

describe("account lifecycle", () => {
  beforeEach(async () => {
    resetRateLimiters();
    await query(`DELETE FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [
      USERNAME,
    ]);
    await query(`DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [
      USERNAME,
    ]);
    await query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [USERNAME]);
    await query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [USERNAME]);
    await query(`DELETE FROM users WHERE username = $1`, [USERNAME]);
  });

  afterAll(async () => {
    if (!globalThis.__PG_POOL_ENDED) {
      globalThis.__PG_POOL_ENDED = true;
      await pool.end();
    }
  });

  test("email verification flow works", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: USERNAME, email: EMAIL, password: PASSWORD }).expect(201);
    const login = await agent.post("/api/auth/login").send({ identifier: USERNAME, password: PASSWORD });
    expect(login.status).toBe(200);

    const csrf = extractCsrfToken(login);
    const requestVerify = await agent
      .post("/api/auth/email/verify/request")
      .set("x-csrf-token", csrf)
      .send();
    expect([200, 204]).toContain(requestVerify.status);

    const token = requestVerify.body?.verify_token;
    expect(token).toBeDefined();

    const complete = await agent.post("/api/auth/email/verify/complete").set("x-csrf-token", csrf).send({ token });
    expect(complete.status).toBe(204);

    const user = await query(`SELECT email_verified_at FROM users WHERE username = $1`, [USERNAME]);
    expect(user.rows[0].email_verified_at).not.toBeNull();
  });

  test("change password requires current and revokes sessions", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: USERNAME, email: EMAIL, password: PASSWORD }).expect(201);
    const login = await agent.post("/api/auth/login").send({ identifier: USERNAME, password: PASSWORD });
    expect(login.status).toBe(200);
    const csrf = extractCsrfToken(login);

    const change = await agent
      .post("/api/auth/password/change")
      .set("x-csrf-token", csrf)
      .send({ current_password: PASSWORD, new_password: "EvenStronger1!" });
    expect(change.status).toBe(204);

    const meAfter = await agent.get("/api/auth/me");
    expect(meAfter.status).toBe(401); // session revoked

    const oldLogin = await agent.post("/api/auth/login").send({ identifier: USERNAME, password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    resetRateLimiters();
    const newLogin = await agent
      .post("/api/auth/login")
      .send({ identifier: USERNAME, password: "EvenStronger1!" });
    expect(newLogin.status).toBe(200);
  });

  test("delete account removes user and sessions", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: USERNAME, email: EMAIL, password: PASSWORD }).expect(201);
    const login = await agent.post("/api/auth/login").send({ identifier: USERNAME, password: PASSWORD });
    expect(login.status).toBe(200);
    const csrf = extractCsrfToken(login);

    const del = await agent.delete("/api/auth/account").set("x-csrf-token", csrf).send();
    expect(del.status).toBe(204);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);

    const user = await query(`SELECT id FROM users WHERE username = $1`, [USERNAME]);
    expect(user.rowCount).toBe(0);
  });
});
