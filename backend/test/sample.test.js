import request from "supertest";
import app from "../src/app.js";

describe("sample route", () => {
  test("requires auth and policy", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ username: "betauser", email: "beta@example.com", password: "password123" });
    await agent.post("/api/auth/login").send({ identifier: "betauser", password: "password123" });

    const forbidden = await agent.get("/api/hello");
    expect(forbidden.status).toBe(403);

    // grant beta role
    await agent
      .put("/api/admin/users/1/roles")
      .send({ roles: ["beta", "user"] })
      .set("Cookie", agent.get("Cookie") || "");

    const ok = await agent.get("/api/hello");
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("message");
  });
});
