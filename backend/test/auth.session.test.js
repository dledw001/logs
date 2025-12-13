import { query, pool } from "../src/db/db.js";
import { registerUser, agent } from "./helpers/auth.js";

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
