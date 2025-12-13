import { jest } from "@jest/globals";

describe("db module error handling", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;
  });

  test("query surfaces errors from pool", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/logs_dev";
    process.env.DATABASE_URL_TEST = "postgres://user:pass@localhost:5432/logs_test";

    const err = new Error("db down");
    const fakePool = { query: jest.fn(() => { throw err; }), end: jest.fn() };
    const Pool = jest.fn(() => fakePool);
    jest.unstable_mockModule("pg", () => ({ default: { Pool } }));

    const mod = await import(`../src/db/db.js?err=${Date.now()}`);
    await expect(mod.query("select 1")).rejects.toThrow("db down");
  });
});
