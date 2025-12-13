import { jest } from "@jest/globals";

describe("audit logger db writer", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.AUDIT_DB_ENABLED;
    delete process.env.AUDIT_LOG_ENABLED;
  });

  test("writes to DB when enabled", async () => {
    process.env.AUDIT_LOG_ENABLED = "true";
    process.env.AUDIT_DB_ENABLED = "true";

    const query = jest.fn();
    jest.unstable_mockModule("../src/db/db.js", () => ({ query }));

    const { audit } = await import(`../src/logger/audit.js?db=${Date.now()}`);
    await audit("test.event", { user_id: 1, username: "u1", email: "u1@example.com", ip: "127.0.0.1" });
    await new Promise((r) => setTimeout(r, 0));

    expect(query).toHaveBeenCalled();
    const call = query.mock.calls[0];
    expect(call[0]).toMatch(/INSERT INTO audit_log/);
  });
});
