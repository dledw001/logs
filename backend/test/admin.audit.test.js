import request from "supertest";
import app from "../src/app.js";
import { query, pool } from "../src/db/db.js";
import { agent, registerUser } from "./helpers/auth.js";

const ADMIN_USERNAME = "audit_admin";
const ADMIN_EMAIL = "audit_admin@example.com";
const ADMIN_PASSWORD = "Secur3Pass!";

describe("admin audit log", () => {
  beforeEach(async () => {
    await query(`DELETE FROM audit_log`);
    await query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [ADMIN_USERNAME]);
    await query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [ADMIN_USERNAME]);
    await query(`DELETE FROM users WHERE username = $1`, [ADMIN_USERNAME]);
  });

  afterAll(async () => {
    if (!globalThis.__PG_POOL_ENDED) {
      globalThis.__PG_POOL_ENDED = true;
      await pool.end();
    }
  });

  test("admin can fetch audit log with filters", async () => {
    const adminAgent = agent();
    const reg = await registerUser(adminAgent, {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    const adminId = reg.body.id;
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, (SELECT id FROM roles WHERE name = 'admin'))`, [
      adminId,
    ]);
    await adminAgent.login({ identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    // seed an audit row
    await query(
      `INSERT INTO audit_log (ts, event, user_id, username, email, ip, meta)
       VALUES (now(), 'auth.login.success', $1, $2, $3, '127.0.0.1', '{}')`,
      [adminId, ADMIN_USERNAME, ADMIN_EMAIL]
    );

    const res = await request(app)
      .get("/api/admin/audit-log")
      .set("Cookie", adminAgent.cookieHeader())
      .query({ event: "auth.login.success", user_id: adminId, limit: 10 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.entries[0].event).toBe("auth.login.success");
  });
});
