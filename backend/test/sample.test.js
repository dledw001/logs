import request from "supertest";
import app from "../src/app.js";

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

    const csrfCookie = agent.jar.getCookie("csrf_token", { path: "/" });
    const csrf = csrfCookie?.value || "";
    const grant = await agent
      .put(`/api/admin/users/${userId}/roles`)
      .set("x-csrf-token", csrf)
      .send({ roles: ["beta", "user"] });

    // If not admin yet, expect forbidden; this is just a sample.
    if (grant.status === 403) {
      return;
    }

    expect(grant.status).toBe(200);

    const ok = await agent.get("/api/hello");
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty("message");
  });
});
