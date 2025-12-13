import { query, pool } from "../src/db/db.js";
import { verifyPassword } from "../src/auth/password.js";
import { agent, registerUser } from "./helpers/auth.js";

const TEST_USERNAME = "testUser123";
const TEST_EMAIL = "testuser123@example.com";
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
    client = agent();

    await query(
        `DELETE FROM sessions
     WHERE user_id IN (SELECT id FROM users WHERE username = $1)`,
        [CLEAN_TEST_USERNAME]
    );
    await query("DELETE FROM users WHERE username = $1", [CLEAN_TEST_USERNAME]);
});

test("POST /api/auth/register creates a user with hashed password and returns Location", async () => {
    const res = await registerUser(client, {
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    expect(res.statusCode).toBe(201);

    expect(res.headers.location).toMatch(/^\/api\/users\/\d+$/);

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

    const dbRes = await query(
        `SELECT username, username_display, email, password_hash
     FROM users
     WHERE username = $1`,
        [CLEAN_TEST_USERNAME]
    );

    expect(dbRes.rowCount).toBe(1);

    const row = dbRes.rows[0];
    expect(row.username).toBe(CLEAN_TEST_USERNAME);
    expect(row.username_display).toBe(DISPLAY_TEST_USERNAME);
    expect(row.email).toBe(CLEAN_TEST_EMAIL);

    expect(row.password_hash).not.toBe(TEST_PASSWORD);
    expect(await verifyPassword(TEST_PASSWORD, row.password_hash)).toBe(true);
});

test("POST /api/auth/register returns 409 for duplicate username (case-insensitive)", async () => {
    const first = await registerUser(client, {
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    expect(first.statusCode).toBe(201);

    const second = await registerUser(client, {
        username: "TeStUsEr123",
        email: "different@example.com",
        password: "differentPass123!",
    }, { cleanup: false });
    expect(second.statusCode).toBe(409);
});

test("POST /api/auth/register returns 409 for duplicate email (case-insensitive)", async () => {
    const first = await registerUser(client, {
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    expect(first.statusCode).toBe(201);

    const second = await registerUser(client, {
        username: "differentuser",
        email: "TESTUSER123@EXAMPLE.COM",
        password: "differentPass123!",
    }, { cleanup: false });
    expect(second.statusCode).toBe(409);
});

test.each([
    // missing fields
    [{ email: TEST_EMAIL, password: TEST_PASSWORD }, 400],
    [{ username: TEST_USERNAME, password: TEST_PASSWORD }, 400],
    [{ username: TEST_USERNAME, email: TEST_EMAIL }, 400],

    // username rules
    [{ username: "ab", email: TEST_EMAIL, password: TEST_PASSWORD }, 400],
    [{ username: "thisusernameiswaytoolongtobevalid1234567890", email: TEST_EMAIL, password: TEST_PASSWORD }, 400],
    [{ username: "bad name", email: TEST_EMAIL, password: TEST_PASSWORD }, 400],

    // password rules
    [{ username: "goodname", email: TEST_EMAIL, password: "short" }, 400],
    [{ username: "goodname", email: TEST_EMAIL, password: "x".repeat(129) }, 400],
    [{ username: "testuser", email: TEST_EMAIL, password: "testuser" }, 400],
    [{ username: "TestUser", email: TEST_EMAIL, password: "testuser" }, 400],
    [{ username: "testuser", email: TEST_EMAIL, password: "ZZZtestuserYYY" }, 400],

    // invalid email
    [{ username: "goodname", email: "not-an-email", password: TEST_PASSWORD }, 400],
])("POST /api/auth/register rejects invalid input %#", async (body, expectedStatus) => {
    const res = await registerUser(client, body);
    expect(res.statusCode).toBe(expectedStatus);
});
