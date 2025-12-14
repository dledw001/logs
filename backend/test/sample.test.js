import request from "supertest";
import app from "../src/app.js";
import { query } from "../src/db/db.js";

describe("sample route", () => {
  test("requires auth and policy", async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post("/api/auth/register")
      .send({ username: "betauser", email: "beta@example.com", password: "password123" });
    const userId = reg.body.id;
    await agent.post("/api/auth/login").send({ identifier: "betauser", password: "password123" });

    const forbidden = await agent.get("/api/hello");
    expect(forbidden.status).toBe(403);

    // Bypass the admin endpoint for this sample: directly grant roles
    await query(`UPDATE users SET is_admin = true WHERE id = $1`, [userId]);
    await query(`INSERT INTO roles (name) VALUES ('beta'), ('admin') ON CONFLICT DO NOTHING`);
    await query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name IN ('beta','admin')
       ON CONFLICT DO NOTHING`,
      [userId]
    );

    const ok = await agent.get("/api/hello");
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("message");
  });
});
