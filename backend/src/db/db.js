import dotenv from "dotenv";
dotenv.config({ quiet: true });

import pkg from "pg";
const { Pool } = pkg;

const isTest = process.env.NODE_ENV === "test";
const connectionString = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("No database connection string set. Set DATABASE_URL (and DATABASE_URL_TEST for tests).");
}

const pool = new Pool({ connectionString });

const LOG_DB = process.env.LOG_DB_QUERIES === "true";

export async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);

    if (LOG_DB) {
        console.log("db query", {
            text,
            duration: Date.now() - start,
            rows: res.rowCount,
        });
    }

    return res;
}

export { pool };
