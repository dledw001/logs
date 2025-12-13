import { jest } from "@jest/globals";

describe("audit logger", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.AUDIT_LOG_ENABLED;
    delete process.env.AUDIT_LOG_CONSOLE;
    delete process.env.AUDIT_LOG_FILE;
  });

  test("redacts secrets and logs to console when enabled", async () => {
    process.env.AUDIT_LOG_ENABLED = "true";
    process.env.AUDIT_LOG_CONSOLE = "true";
    process.env.AUDIT_LOG_FILE = "audit.log";

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { audit } = await import(`../src/logger/audit.js?console=${Date.now()}`);
    await audit("test.event", { password: "secret", token: "abc", ok: true });
    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).toContain("[redacted]");
    consoleSpy.mockRestore();
  });

  test("handles file write errors gracefully", async () => {
    process.env.AUDIT_LOG_ENABLED = "true";
    process.env.AUDIT_LOG_CONSOLE = "false";
    process.env.AUDIT_LOG_FILE = "/nonexistent/dir/audit.log";
    process.env.AUDIT_DB_ENABLED = "false";

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    jest.unstable_mockModule("node:fs/promises", () => ({
      appendFile: jest.fn(() => {
        throw new Error("write fail");
      }),
      mkdir: jest.fn(() => {}),
    }));

    const { audit } = await import(`../src/logger/audit.js?error=${Date.now()}`);
    await audit("test.event", { ok: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
