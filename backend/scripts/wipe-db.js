import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { Client } from "pg";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DBS = [
    { name: "DEV", url: process.env.DATABASE_URL },
    { name: "TEST", url: process.env.DATABASE_URL_TEST },
];

for (const db of DBS) {
    if (!db.url) {
        throw new Error(`${db.name} database URL is not set`);
    }
}

const rl = readline.createInterface({ input, output });

console.log("⚠️  DANGER ZONE");
console.log("This will IRREVERSIBLY wipe the following databases:\n");

for (const db of DBS) {
    console.log(`- ${db.name}: ${db.url}`);
}

console.log("");
const answer = await rl.question(
    "Type WIPE to continue (anything else aborts): "
);

if (answer !== "WIPE") {
    console.log("Aborted.");
    process.exit(0);
}

for (const db of DBS) {
    console.log(`\nWiping ${db.name} database…`);

    const client = new Client({ connectionString: db.url });
    await client.connect();

    await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    await client.query("GRANT ALL ON SCHEMA public TO public;");

    await client.end();

    console.log(`${db.name} wiped.`);
}

rl.close();
console.log("\n✅ All databases wiped successfully.");
