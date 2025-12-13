import { agent } from "./helpers/auth.js";
import { hashSessionToken } from "../src/auth/session.js";
import { query } from "../src/db/db.js";
import { csrfProtection } from "../src/middleware/csrf.js";
import { handleLogout, handleLogin, loginLimiterByIdentifier, loginLimiterByIp } from "../src/routes/auth.js";
import { handleMetrics } from "../src/app.js";

afterAll(async () => {
    // nothing else to clean up; pool ended by other suites
});

beforeEach(() => {});

test("CSRF protection rejects missing token on unsafe route", async () => {
    const client = agent();
    const res = await client._invoke(handleLogout, {
        path: "/api/auth/logout",
        method: "POST",
        middleware: [csrfProtection()],
        csrf: false,
    });
    expect(res.statusCode).toBe(403);
});

test("rate limiter blocks repeated login attempts", async () => {
    const client = agent();
    const payload = { identifier: "nope", password: "bad" };

    await client._invoke(handleLogin, {
        body: payload,
        path: "/api/auth/login",
        middleware: [loginLimiterByIp, loginLimiterByIdentifier],
    });
    await client._invoke(handleLogin, {
        body: payload,
        path: "/api/auth/login",
        middleware: [loginLimiterByIp, loginLimiterByIdentifier],
    });
    const third = await client._invoke(handleLogin, {
        body: payload,
        path: "/api/auth/login",
        middleware: [loginLimiterByIp, loginLimiterByIdentifier],
    });
    expect(third.statusCode).toBe(429);
});

test("idle timeout revokes sessions after inactivity", async () => {
    const client = agent();
    // cleanup in case previous runs left residue in Postgres
    await query(`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, ["idleuser"]);
    await query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = $1)`, ["idleuser"]);
    await query(`DELETE FROM users WHERE username = $1`, ["idleuser"]);

    const reg = await client.register({ username: "idleuser", email: "idle@example.com", password: "Secur3Pass!" });
    expect(reg.statusCode).toBe(201);
    const login = await client.login({ identifier: "idleuser", password: "Secur3Pass!" });
    expect(login.statusCode).toBe(200);

    const sid = client.getCookie("sid");
    const tokenHash = hashSessionToken(sid);

    // set last_seen far in the past
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await query(`UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2`, [past, tokenHash]);

    const me = await client.me();
    expect(me.statusCode).toBe(401);
});

test("metrics endpoint returns basic fields", async () => {
    const client = agent();
    const res = await client._invoke(handleMetrics, { path: "/metrics", method: "GET" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("service", "logs-backend");
    expect(res.body).toHaveProperty("requests_total");
});
