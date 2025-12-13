import { jest } from "@jest/globals";

describe("db module env selection", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.USE_IN_MEMORY_DB;
    delete process.env.DATABASE_URL;
  });

  test("falls back to in-memory when flag set", async () => {
    process.env.USE_IN_MEMORY_DB = "true";
    const mod = await import(`../src/db/db.js?mem=${Date.now()}`);
    expect(mod.useMemoryDb).toBe(true);
    expect(typeof mod.query).toBe("function");
  });

  test("initializes Pool when DATABASE_URL is provided", async () => {
    process.env.USE_IN_MEMORY_DB = "false";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/logs_test";

    const fakePool = { query: jest.fn(), end: jest.fn() };
    const Pool = jest.fn(() => fakePool);
    jest.unstable_mockModule("pg", () => ({ default: { Pool } }));

    const mod = await import(`../src/db/db.js?pg=${Date.now()}`);
    expect(mod.useMemoryDb).toBe(false);
    expect(Pool).toHaveBeenCalled();
    const arg = Pool.mock.calls[0][0];
    expect(arg).toHaveProperty("connectionString");
    expect(mod.pool).toBe(fakePool);
  });
});
