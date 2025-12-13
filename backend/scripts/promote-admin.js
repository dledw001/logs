#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { query, pool } from "../src/db/db.js";
import { audit } from "../src/logger/audit.js";

async function main() {
  const email = process.argv.find((arg) => arg.startsWith("--email="))?.split("=")[1];
  const username = process.argv.find((arg) => arg.startsWith("--username="))?.split("=")[1];

  if (!email && !username) {
    console.error("Usage: node scripts/promote-admin.js --email=<email> [--username=<username>]");
    process.exit(1);
  }

  const identifier = email || username;
  const isEmail = email ? true : false;

  const userRes = await query(
    isEmail
      ? `SELECT id, username, email FROM users WHERE email = $1`
      : `SELECT id, username, email FROM users WHERE username = $1`,
    [identifier.toLowerCase()]
  );

  if (userRes.rowCount === 0) {
    console.error("User not found for identifier:", identifier);
    process.exit(1);
  }

  const user = userRes.rows[0];
  const roleRes = await query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (roleRes.rowCount === 0) {
    console.error("Admin role not found; ensure roles are seeded.");
    process.exit(1);
  }

  const roleId = roleRes.rows[0].id;
  await query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [user.id, roleId]
  );
  await query(`UPDATE users SET is_admin = TRUE WHERE id = $1`, [user.id]);

  audit("admin.promote", { actor: "script", user_id: user.id, username: user.username, email: user.email });
  console.log(`Promoted user ${user.username} (${user.email}) to admin.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
