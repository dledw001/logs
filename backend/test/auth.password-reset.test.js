import { query, pool } from "../src/db/db.js";
import { registerUser, agent } from "./helpers/auth.js";
import { hashSessionToken } from "../src/auth/session.js";
import { verifyPassword } from "../src/auth/password.js";

const TEST_USERNAME = "resetUser123";
const TEST_EMAIL = "resetuser123@example.com";
const TEST_PASSWORD = "p@5sW0rd!23";
const CLEAN_TEST_USERNAME = TEST_USERNAME.toLowerCase();

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

    const res = await registerUser(client, { username: TEST_USERNAME, email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.statusCode).toBe(201);
});

test("POST /api/auth/password-reset/request returns token in non-prod and stores hashed token", async () => {
    const res = await client.passwordResetRequest({ identifier: TEST_EMAIL });
    expect(res.statusCode).toBe(200);

    expect(res.body.reset_token).toBeDefined();
    const tokenHash = hashSessionToken(res.body.reset_token);

    const dbToken = await query(
        `SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used_at
         FROM password_reset_tokens prt
         WHERE prt.token_hash = $1`,
        [tokenHash]
    );

    expect(dbToken.rowCount).toBe(1);
    expect(dbToken.rows[0].token_hash).toBe(tokenHash);
    expect(dbToken.rows[0].used_at).toBeNull();
});

test("password reset flow updates password, revokes sessions, and blocks reuse", async () => {
    const loginAgent = agent();

    const login = await loginAgent.login({ identifier: TEST_USERNAME, password: TEST_PASSWORD });
    expect(login.statusCode).toBe(200);

    const requestToken = await client.passwordResetRequest({ identifier: TEST_EMAIL });
    expect(requestToken.statusCode).toBe(200);

    const resetToken = requestToken.body.reset_token;

    const NEW_PASSWORD = "Secur3rP@ss!";
    const complete = await client.passwordResetComplete({ token: resetToken, password: NEW_PASSWORD });
    expect(complete.statusCode).toBe(204);

    const revoked = await loginAgent.me();
    expect(revoked.statusCode).toBe(401); // old session revoked

    const oldLogin = await client.login({ identifier: TEST_USERNAME, password: TEST_PASSWORD });
    expect(oldLogin.statusCode).toBe(401);

    const success = await client.login({ identifier: TEST_USERNAME, password: NEW_PASSWORD });
    expect(success.statusCode).toBe(200);

    expect(success.body.username).toBe(CLEAN_TEST_USERNAME);

    // token cannot be reused
    const reuse = await client.passwordResetComplete({ token: resetToken, password: TEST_PASSWORD });
    expect(reuse.statusCode).toBe(400);

    const dbUser = await query(
        `SELECT username, password_hash FROM users WHERE username = $1`,
        [CLEAN_TEST_USERNAME]
    );
    expect(dbUser.rowCount).toBe(1);
    expect(await verifyPassword(NEW_PASSWORD, dbUser.rows[0].password_hash)).toBe(true);
});

test("rejects invalid or missing tokens", async () => {
    const invalid = await client.passwordResetComplete({
        token: "not-a-real-token",
        password: "anotherPass123!",
    });
    expect(invalid.statusCode).toBe(400);

    const missingToken = await client.passwordResetComplete({ password: "anotherPass123!" });
    expect(missingToken.statusCode).toBe(400);
});
