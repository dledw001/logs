import dotenv from "dotenv";
dotenv.config({ quiet: true });

import pkg from "pg";
import { createMemoryDb } from "./memory.js";
const { Pool } = pkg;

const isTest = process.env.NODE_ENV === "test";
const useMemoryEnv = process.env.USE_IN_MEMORY_DB === "true";
let useMemoryDb = isTest && process.env.USE_IN_MEMORY_DB !== "false";

let pool;
let resetMemory = () => {};

if (useMemoryEnv) {
    useMemoryDb = true;
}

if (useMemoryDb) {
    const mem = createMemoryDb();
    pool = mem.pool;
    resetMemory = mem.resetMemory;
} else {
    const connectionString = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

    if (!connectionString) {
        console.warn("No database connection string set; using in-memory database (ephemeral). Set DATABASE_URL or USE_IN_MEMORY_DB=false to require Postgres.");
        const mem = createMemoryDb();
        pool = mem.pool;
        resetMemory = mem.resetMemory;
        useMemoryDb = true;
    } else {
        pool = new Pool({ connectionString });
    }
}

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

export { pool, resetMemory, useMemoryDb };
