import { pool } from "../src/db/db.js";

afterAll(async () => {
  if (!globalThis.__PG_POOL_ENDED) {
    globalThis.__PG_POOL_ENDED = true;
    try {
      await pool.end();
    } catch (err) {
      // swallow to avoid masking test results
      // eslint-disable-next-line no-console
      console.error("Failed to close db pool", err);
    }
  }
});
