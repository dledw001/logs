import { jest } from "@jest/globals";

describe("db module env selection", () => {
    afterEach(() => {
        jest.resetModules();
        delete process.env.DATABASE_URL;
        delete process.env.DATABASE_URL_TEST;
    });

    test("throws if no connection string provided", async () => {
        delete process.env.DATABASE_URL;
        delete process.env.DATABASE_URL_TEST;
        jest.unstable_mockModule("dotenv", () => ({ default: { config: () => ({}) } }));

        await expect(import(`../src/db/db.js?noenv=${Date.now()}`)).rejects.toThrow(
            "No database connection string set"
        );
    });

    test("initializes Pool when DATABASE_URL is provided", async () => {
        process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/logs_dev";
        process.env.DATABASE_URL_TEST = "postgres://user:pass@localhost:5432/logs_test";

        const fakePool = { query: jest.fn(), end: jest.fn() };
        const Pool = jest.fn(() => fakePool);
        jest.unstable_mockModule("pg", () => ({ default: { Pool } }));

        const mod = await import(`../src/db/db.js?pg=${Date.now()}`);
        expect(Pool).toHaveBeenCalled();
        const arg = Pool.mock.calls[0][0];
        expect(arg).toHaveProperty("connectionString");
        expect(mod.pool).toBe(fakePool);
    });
});
