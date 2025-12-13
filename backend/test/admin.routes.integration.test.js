import request from "supertest";
import app from "../src/app.js";
import { query } from "../src/db/db.js";

const ADMIN_USERNAME = "admin_test";
const ADMIN_EMAIL = "admin_test@example.com";
const ADMIN_PASSWORD = "password123";

const TARGET_USERNAME = "target_user";
const TARGET_EMAIL = "target_user@example.com";

async function promoteToAdmin(userId) {
    const roleRes = await query(`SELECT id FROM roles WHERE name = 'admin'`);
    const roleId = roleRes.rows[0].id;
    await query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
    );
    await query(`UPDATE users SET is_admin = TRUE WHERE id = $1`, [userId]);
}

async function cleanupUsers() {
    await query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username IN ($1,$2,$3,$4))`, [
        ADMIN_USERNAME,
        TARGET_USERNAME,
        ADMIN_USERNAME.toLowerCase(),
        TARGET_USERNAME.toLowerCase(),
    ]);
    await query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username IN ($1,$2,$3,$4))`, [
        ADMIN_USERNAME,
        TARGET_USERNAME,
        ADMIN_USERNAME.toLowerCase(),
        TARGET_USERNAME.toLowerCase(),
    ]);
    await query(`DELETE FROM users WHERE username IN ($1,$2,$3,$4)`, [
        ADMIN_USERNAME,
        TARGET_USERNAME,
        ADMIN_USERNAME.toLowerCase(),
        TARGET_USERNAME.toLowerCase(),
    ]);
}

describe("admin routes (integration)", () => {
    beforeEach(async () => {
        await cleanupUsers();
    });

    test("admin can list users; non-auth is rejected", async () => {
        const adminAgent = request.agent(app);

        const reg = await adminAgent
            .post("/api/auth/register")
            .send({ username: ADMIN_USERNAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
        expect(reg.status).toBe(201);
        const adminId = reg.body?.id;

        await promoteToAdmin(adminId);
        const login = await adminAgent
            .post("/api/auth/login")
            .send({ identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD });
        expect(login.status).toBe(200);

        const unauth = await request(app).get("/api/admin/users");
        expect(unauth.status).toBe(401);

        const res = await adminAgent.get("/api/admin/users");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.users)).toBe(true);
        expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    });

    test("admin can update user roles; invalid roles rejected", async () => {
        const adminAgent = request.agent(app);
        const regAdmin = await adminAgent
            .post("/api/auth/register")
            .send({ username: ADMIN_USERNAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
        expect(regAdmin.status).toBe(201);
        const adminId = regAdmin.body?.id;
        await promoteToAdmin(adminId);
        const adminLogin = await adminAgent
            .post("/api/auth/login")
            .send({ identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD });
        expect(adminLogin.status).toBe(200);

        const targetReg = await request(app)
            .post("/api/auth/register")
            .send({ username: TARGET_USERNAME, email: TARGET_EMAIL, password: "password123" });
        expect(targetReg.status).toBe(201);
        const targetId = targetReg.body?.id;

        const bad = await adminAgent.put(`/api/admin/users/${targetId}/roles`).send({ roles: ["does-not-exist"] });
        expect(bad.status).toBe(400);

        const ok = await adminAgent.put(`/api/admin/users/${targetId}/roles`).send({ roles: ["admin", "user"] });
        expect(ok.status).toBe(200);
        expect(ok.body.roles).toContain("admin");
    });
});
