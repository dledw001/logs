import { query, pool } from "../src/db/db.js";
import { registerUser, agent } from "./helpers/auth.js";
import request from "supertest";
import app from "../src/app.js";

const TEST_USERNAME = "testUser123";
const TEST_EMAIL = "testuser123@example.com";
const TEST_PASSWORD = "p@5sW0rd!23";

const CLEAN_TEST_USERNAME = TEST_USERNAME.trim().toLowerCase();
const DISPLAY_TEST_USERNAME = TEST_USERNAME.trim();

let client;

afterAll(async () => {
    if (!globalThis.__PG_POOL_ENDED) {
        globalThis.__PG_POOL_ENDED = true;
        await pool.end();
    }
});

beforeEach(async () => {
    client = agent();

    await query(
        `DELETE FROM sessions
     WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
        [CLEAN_TEST_USERNAME]
    );
    await query("DELETE FROM users WHERE username = $1", [CLEAN_TEST_USERNAME]);

    const res = await registerUser(client, {
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    expect(res.statusCode).toBe(201);
});

test("GET /api/auth/me requires authentication", async () => {
    const res = await client.me();
    expect(res.statusCode).toBe(401);
});

test("GET /api/auth/me works after login (session persists via agent)", async () => {
    const a = agent();

    const login = await a.login({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(login.statusCode).toBe(200);

    const me = await a.me();
    expect(me.statusCode).toBe(200);

    expect(me.body.username).toBe(CLEAN_TEST_USERNAME);
    expect(me.body.username_display).toBe(DISPLAY_TEST_USERNAME);
    expect(me.body.is_admin).toBe(false);
    expect(me.body.roles).toContain("user");
});

test("POST /api/auth/logout revokes session and clears cookie; /me fails after", async () => {
    const a = agent();

    const login = await a.login({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(login.statusCode).toBe(200);

    const me = await a.me();
    expect(me.statusCode).toBe(200);

    const out = await a.logout();
    expect(out.statusCode).toBe(204);

    const setCookie = out.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = setCookie.join("; ").toLowerCase();
    expect(cookieStr).toContain("sid=");
    expect(cookieStr).toMatch(/max-age=0|expires=/);

    const after = await a.me();
    expect(after.statusCode).toBe(401);
});

test("POST /api/auth/logout is idempotent", async () => {
    const anon = agent();
    const res = await anon.logout();
    expect(res.statusCode).toBe(204);
});

test("session listing and revoke others works", async () => {
    const a1 = agent();
    await a1.login({ identifier: TEST_USERNAME, password: TEST_PASSWORD });
    const a2 = agent();
    await a2.login({ identifier: TEST_USERNAME, password: TEST_PASSWORD });

    const csrf = a2.getCookie("csrf_token");
    const realList = await request(app).get("/api/auth/sessions").set("Cookie", a2.cookieHeader());
    expect(realList.status).toBe(200);
    expect(Array.isArray(realList.body.sessions)).toBe(true);
    expect(realList.body.sessions.length).toBeGreaterThanOrEqual(2);

    const revoke = await request(app)
        .post("/api/auth/sessions/revoke-others")
        .set("Cookie", a2.cookieHeader())
        .set("x-csrf-token", csrf || "");
    expect(revoke.status).toBe(204);

    const me1 = await a1.me();
    expect(me1.statusCode).toBe(401);
});

test("current session endpoint returns metadata", async () => {
    const httpAgent = request.agent(app);
    await httpAgent
        .post("/api/auth/register")
        .send({ username: TEST_USERNAME, email: TEST_EMAIL, password: TEST_PASSWORD })
        .set("User-Agent", "jest-session-test");

    const login = await httpAgent
        .post("/api/auth/login")
        .set("User-Agent", "jest-session-test")
        .send({ identifier: TEST_USERNAME, password: TEST_PASSWORD });
    expect(login.status).toBe(200);

    const meSession = await httpAgent.get("/api/auth/session");
    expect(meSession.status).toBe(200);
    expect(meSession.body).toHaveProperty("user_agent");
    expect(String(meSession.body.user_agent)).toContain("jest-session-test");
    expect(meSession.body).toHaveProperty("ip");
});
