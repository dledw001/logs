import { agent, registerUser } from "./helpers/auth.js";
import { query, pool, resetMemory } from "../src/db/db.js";
import { requireAuth } from "../src/middleware/auth.js";
import { requireRole } from "../src/auth/authorization.js";
import { handleAdminPing } from "../src/routes/admin.js";

const USERNAME = "adminUser1";
const EMAIL = "adminuser1@example.com";
const PASSWORD = "Secur3Pass!123";

afterAll(async () => {
    if (!globalThis.__PG_POOL_ENDED) {
        globalThis.__PG_POOL_ENDED = true;
        await pool.end();
    }
});

beforeEach(async () => {
    resetMemory();
    await query(
        `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
        [USERNAME.toLowerCase()]
    );
    await query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, [
        USERNAME.toLowerCase(),
    ]);
    await query(`DELETE FROM users WHERE username = $1`, [USERNAME.toLowerCase()]);
});

test("non-admin cannot access admin route; admin can", async () => {
    const client = agent();
    const res = await registerUser(client, { username: USERNAME, email: EMAIL, password: PASSWORD });
    expect(res.statusCode).toBe(201);

    const login = await client.login({ identifier: USERNAME, password: PASSWORD });
    expect(login.statusCode).toBe(200);

    const forbidden = await client._invoke(handleAdminPing, {
        path: "/admin/ping",
        method: "GET",
        middleware: [requireAuth, requireRole("admin")],
    });
    expect(forbidden.statusCode).toBe(403);

    const userId = res.body.id;
    await query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, (SELECT id FROM roles WHERE name = 'admin'))`,
        [userId]
    );

    const relogin = await client.login({ identifier: USERNAME, password: PASSWORD });
    expect(relogin.statusCode).toBe(200);
    expect(relogin.body.roles).toContain("admin");

    const allowed = await client._invoke(handleAdminPing, {
        path: "/admin/ping",
        method: "GET",
        middleware: [requireAuth, requireRole("admin")],
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body.ok).toBe(true);
});
