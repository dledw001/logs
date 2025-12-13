import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { Client } from "pg";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST not set");

const client = new Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
await client.query("CREATE SCHEMA public;");
await client.query("GRANT ALL ON SCHEMA public TO public;");
await client.end();

execSync("node-pg-migrate up -m migrations -d DATABASE_URL_TEST", { stdio: "inherit" });
