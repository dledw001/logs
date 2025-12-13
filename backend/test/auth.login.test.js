import { query, pool, resetMemory } from "../src/db/db.js";
import { agent, registerUser } from "./helpers/auth.js";

const TEST_USERNAME = "testUser123";
const TEST_EMAIL = "TestUser123@Example.com";
const TEST_PASSWORD = "p@5sW0rd!23";

const CLEAN_TEST_USERNAME = TEST_USERNAME.trim().toLowerCase();
const DISPLAY_TEST_USERNAME = TEST_USERNAME.trim();
const CLEAN_TEST_EMAIL = TEST_EMAIL.trim().toLowerCase();

let client;

afterAll(async () => {
    if (!globalThis.__PG_POOL_ENDED) {
        globalThis.__PG_POOL_ENDED = true;
        await pool.end();
    }
});

beforeEach(async () => {
    resetMemory();
    client = agent();

    // clean sessions first (FK cascade might handle it, but be explicit)
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

test("POST /api/auth/login succeeds with username identifier, sets HttpOnly sid cookie, and does not leak secrets", async () => {
    const res = await client.login({ identifier: TEST_USERNAME, password: TEST_PASSWORD });
    expect(res.statusCode).toBe(200);

    expect(res.body).toHaveProperty("id");
    expect(typeof res.body.id).toBe("number");

    expect(res.body.username).toBe(CLEAN_TEST_USERNAME);
    expect(res.body.username_display).toBe(DISPLAY_TEST_USERNAME);
    expect(res.body.email).toBe(CLEAN_TEST_EMAIL);
    expect(res.body.is_admin).toBe(false);
    expect(res.body.roles).toContain("user");

    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("password_hash");
    expect(JSON.stringify(res.body)).not.toContain(TEST_PASSWORD);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie)).toBe(true);

    const cookieStr = setCookie.join("; ").toLowerCase();
    expect(cookieStr).toContain("sid=");
    expect(cookieStr).toContain("httponly");
});

test("POST /api/auth/login succeeds with email identifier", async () => {
    const res = await client.login({ identifier: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.statusCode).toBe(200);
});

test("POST /api/auth/login rejects wrong password", async () => {
    const res = await client.login({ identifier: TEST_USERNAME, password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
});

test("POST /api/auth/login rejects non-existent user/email", async () => {
    const first = await client.login({ identifier: "doesnotexist", password: "whateverpassword" });
    expect(first.statusCode).toBe(401);

    const second = await client.login({ identifier: "nobody@example.com", password: "whateverpassword" });
    expect(second.statusCode).toBe(401);
});

test("POST /api/auth/login is case-insensitive for username and email", async () => {
    const first = await client.login({ identifier: "TESTUSER123", password: TEST_PASSWORD });
    expect(first.statusCode).toBe(200);

    const second = await client.login({ identifier: "TESTUSER123@EXAMPLE.COM", password: TEST_PASSWORD });
    expect(second.statusCode).toBe(200);
});

// Optional: keep legacy payload support if you still accept { username, password } / { email, password }
test("POST /api/auth/login supports legacy username/email fields", async () => {
    const usernameLogin = await client.login({ username: TEST_USERNAME, password: TEST_PASSWORD });
    expect(usernameLogin.statusCode).toBe(200);

    const emailLogin = await client.login({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(emailLogin.statusCode).toBe(200);
});
