import { Router } from "express";
import { query } from "../db/db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
    generateSessionToken,
    hashSessionToken,
    SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS,
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_ROLLING_RENEWAL_MINUTES,
    SESSION_MAX_PER_USER,
    cookieOptions,
} from "../auth/session.js";
import { requireAuth } from "../middleware/auth.js";
import { csrfProtection, issueCsrfToken } from "../middleware/csrf.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import { audit } from "../logger/audit.js";

const router = Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;

const EMAIL_MAX = 254; // practical max for emails
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// lowercase letters, digits, underscore, dot, dash
const USERNAME_RE = /^[a-z0-9_.-]+$/;

// "good enough" email regex (don’t try to fully validate RFC 5322 with regex)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_VERIFY_TTL_MINUTES = 60 * 24;

const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = EMAIL_VERIFY_TTL_MINUTES * 60 * 1000;

const LOGIN_LIMIT_WINDOW_MS = Number(process.env.LOGIN_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_LIMIT_IP_MAX = Number(process.env.LOGIN_LIMIT_IP_MAX || 10);
const LOGIN_LIMIT_ID_MAX = Number(process.env.LOGIN_LIMIT_ID_MAX || 7);
const LOGIN_LIMIT_BLOCK_MS = Number(process.env.LOGIN_LIMIT_BLOCK_MS || 15 * 60 * 1000);

const RESET_LIMIT_WINDOW_MS = Number(process.env.RESET_LIMIT_WINDOW_MS || 60 * 60 * 1000);
const RESET_LIMIT_MAX = Number(process.env.RESET_LIMIT_MAX || 5);
const RESET_LIMIT_BLOCK_MS = Number(process.env.RESET_LIMIT_BLOCK_MS || 60 * 60 * 1000);

export const loginLimiterByIp = createRateLimiter({
    name: "login-ip",
    windowMs: LOGIN_LIMIT_WINDOW_MS,
    max: LOGIN_LIMIT_IP_MAX,
    blockDurationMs: LOGIN_LIMIT_BLOCK_MS,
    keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown",
});

export const loginLimiterByIdentifier = createRateLimiter({
    name: "login-identifier",
    windowMs: LOGIN_LIMIT_WINDOW_MS,
    max: LOGIN_LIMIT_ID_MAX,
    blockDurationMs: LOGIN_LIMIT_BLOCK_MS,
    keyGenerator: (req) => extractIdentifier(req.body) || "unknown",
});

const passwordResetLimiter = createRateLimiter({
    name: "password-reset",
    windowMs: RESET_LIMIT_WINDOW_MS,
    max: RESET_LIMIT_MAX,
    blockDurationMs: RESET_LIMIT_BLOCK_MS,
    keyGenerator: (req) => extractIdentifier(req.body) || req.ip || "unknown",
});

router.use(
    csrfProtection({
        skipPaths: ["/login", "/register", "/password-reset/request", "/password-reset/complete"],
    })
);

function normalizeUsername(input) {
    const raw = typeof input === "string" ? input : "";
    const clean = raw.trim().toLowerCase();
    const display = raw.trim();
    return { clean, display };
}

function normalizeEmail(input) {
    const raw = typeof input === "string" ? input : "";
    // trim + lower for canonical identity
    const clean = raw.trim().toLowerCase();
    return clean;
}

function isLikelyEmail(identifier) {
    return EMAIL_RE.test(identifier);
}

function validateUsername(cleanUsername) {
    if (cleanUsername.length < USERNAME_MIN || cleanUsername.length > USERNAME_MAX) {
        return `username must be ${USERNAME_MIN}-${USERNAME_MAX} characters`;
    }
    if (!USERNAME_RE.test(cleanUsername)) {
        return "username may contain only letters, numbers, underscore, dot, and dash";
    }
    return null;
}

function validateEmail(cleanEmail) {
    if (cleanEmail.length > EMAIL_MAX) {
        return `email must be <= ${EMAIL_MAX} characters`;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
        return "email must be a valid email address";
    }
    return null;
}

function validatePassword(pwd, cleanUsername, cleanEmail) {
    if (pwd.length < PASSWORD_MIN || pwd.length > PASSWORD_MAX) {
        return `password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`;
    }

    const pwdNorm = pwd.toLowerCase();
    if (cleanUsername && cleanUsername === pwdNorm) {
        return "username and password cannot be the same";
    }
    if (cleanEmail && cleanEmail === pwdNorm) {
        return "email and password cannot be the same";
    }

    if (cleanUsername && cleanUsername.length >= 4 && pwdNorm.includes(cleanUsername)) {
        return "password must not contain your username";
    }

    if (cleanEmail && pwdNorm.includes(cleanEmail)) {
        return "password must not contain your email";
    }

    return null;
}

function extractIdentifier(reqBody) {
    const { identifier, username, email } = reqBody;
    const rawIdentifier =
        typeof identifier === "string"
            ? identifier
            : typeof email === "string"
                ? email
                : typeof username === "string"
                    ? username
                    : "";
    return rawIdentifier.trim().toLowerCase();
}

async function findUserByIdentifier(cleanIdentifier) {
    const whereClause = isLikelyEmail(cleanIdentifier) ? "email = $1" : "username = $1";
    const result = await query(
         `SELECT u.id,
                u.username,
                u.username_display,
                u.email,
                u.email_verified_at,
                u.password_hash,
                u.is_admin,
                u.created_at,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE ${whereClause}
         GROUP BY u.id, u.username, u.username_display, u.email, u.password_hash, u.is_admin, u.created_at`,
        [cleanIdentifier]
    );
    return result.rowCount ? result.rows[0] : null;
}

export async function handleRegister(req, res) {
    const { username, email, password } = req.body;

    const { clean: cleanUsername, display: displayUsername } = normalizeUsername(username);
    const cleanEmail = normalizeEmail(email);
    const pwd = typeof password === "string" ? password : "";

    // presence
    if (!cleanUsername || !cleanEmail || !pwd) {
        return res.status(400).json({ error: "username, email, and password required" });
    }

    const error =
        validateUsername(cleanUsername) ||
        validateEmail(cleanEmail) ||
        validatePassword(pwd, cleanUsername, cleanEmail);

    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const hashedPassword = await hashPassword(pwd);

        // Rely on UNIQUE constraints + 23505 handling (no race condition window)
        const result = await query(
            `INSERT INTO users (username, username_display, email, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, username_display, email, email_verified_at, is_admin, created_at`,
            [cleanUsername, displayUsername, cleanEmail, hashedPassword]
        );

        const user = result.rows[0];

        await query(
            `INSERT INTO user_roles (user_id, role_id)
             VALUES ($1, (SELECT id FROM roles WHERE name = 'user'))
             ON CONFLICT DO NOTHING`,
            [user.id]
        );

        res.location(`/api/users/${user.id}`);
        audit("auth.register.success", {
            user_id: user.id,
            username: user.username,
            email: user.email,
            ip: req.ip,
        });

        return res.status(201).json({
            id: user.id,
            username: user.username,
            username_display: user.username_display,
            email: user.email,
            email_verified_at: user.email_verified_at,
            is_admin: user.is_admin,
            roles: ["user"],
            created_at: user.created_at,
        });
    } catch (err) {
        if (err?.code === "23505") {
            if (err.constraint && String(err.constraint).includes("email")) {
                audit("auth.register.conflict", { reason: "email", email: cleanEmail, ip: req.ip });
                return res.status(409).json({ error: "email already in use" });
            }
            audit("auth.register.conflict", { reason: "username", username: cleanUsername, ip: req.ip });
            return res.status(409).json({ error: "username already in use" });
        }
        console.error("POST /auth/register error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handleLogin(req, res) {
    const cleanIdentifier = extractIdentifier(req.body);
    const pwd = typeof req.body?.password === "string" ? req.body.password : "";

    if (!cleanIdentifier || !pwd) {
        return res.status(400).json({ error: "identifier and password required" });
    }

    try {
        const user = await findUserByIdentifier(cleanIdentifier);
        if (!user) {
            audit("auth.login.failed", { reason: "invalid_credentials", identifier: cleanIdentifier, ip: req.ip });
            return res.status(401).json({ error: "invalid credentials" });
        }

        const ok = await verifyPassword(pwd, user.password_hash);
        if (!ok) {
            audit("auth.login.failed", { reason: "invalid_credentials", identifier: cleanIdentifier, ip: req.ip });
            return res.status(401).json({ error: "invalid credentials" });
        }

        // create session (retry once if token_hash collides; extremely unlikely)
        let token = generateSessionToken();
        let tokenHash = hashSessionToken(token);
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

        try {
            await query(
                `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
                 VALUES ($1, $2, $3, $4, $5)`,
                [user.id, tokenHash, expiresAt, req.get?.("user-agent") || "", req.ip || ""]
            );
        } catch (e) {
            if (e?.code !== "23505") throw e;
            token = generateSessionToken();
            tokenHash = hashSessionToken(token);
            await query(
                `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
                 VALUES ($1, $2, $3, $4, $5)`,
                [user.id, tokenHash, expiresAt, req.get?.("user-agent") || "", req.ip || ""]
            );
        }

        res.cookie(SESSION_COOKIE_NAME, token, {
            ...cookieOptions(),
            maxAge: SESSION_TTL_MS,
        });
        issueCsrfToken(res);

        // enforce max concurrent sessions
        if (SESSION_MAX_PER_USER > 0) {
            await query(
                `WITH ordered AS (
                    SELECT id FROM sessions
                    WHERE user_id = $1 AND revoked_at IS NULL
                    ORDER BY last_seen_at DESC
                    OFFSET $2
                )
                UPDATE sessions SET revoked_at = now() WHERE id IN (SELECT id FROM ordered)`,
                [user.id, SESSION_MAX_PER_USER]
            );
        }
        audit("auth.login.success", { user_id: user.id, username: user.username, ip: req.ip });

        return res.status(200).json({
            id: user.id,
            username: user.username,
            username_display: user.username_display,
            email: user.email,
            email_verified_at: user.email_verified_at,
            is_admin: user.is_admin,
            roles: Array.isArray(user.roles) ? user.roles : [],
            created_at: user.created_at,
        });
    } catch (err) {
        console.error("POST /auth/login error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handlePasswordResetRequest(req, res) {
    const clean = extractIdentifier(req.body);
    if (!clean) {
        return res.status(400).json({ error: "identifier required" });
    }

    try {
        const user = await findUserByIdentifier(clean);

        // Avoid leaking whether the user exists. Only return a token in test/dev to keep DX.
        if (user) {
            const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
            let resetToken = generateSessionToken();
            let tokenHash = hashSessionToken(resetToken);

            try {
                await query(
                    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                     VALUES ($1, $2, $3)`,
                    [user.id, tokenHash, expiresAt]
                );
            } catch (e) {
                if (e?.code !== "23505") throw e;
                resetToken = generateSessionToken();
                tokenHash = hashSessionToken(resetToken);
                await query(
                    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                     VALUES ($1, $2, $3)`,
                    [user.id, tokenHash, expiresAt]
                );
            }

            if (process.env.NODE_ENV !== "production") {
                return res.status(200).json({
                    reset_token: resetToken,
                    expires_in_minutes: PASSWORD_RESET_TTL_MINUTES,
                });
            }
        }
        audit("auth.password_reset.request", {
            identifier: clean,
            user_found: Boolean(user),
            ip: req.ip,
        });

        return res.status(204).send();
    } catch (err) {
        console.error("POST /auth/password-reset/request error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handlePasswordResetComplete(req, res) {
    const rawToken = typeof req.body?.token === "string" ? req.body.token : "";
    const pwd = typeof req.body?.password === "string" ? req.body.password : "";

    if (!rawToken || !pwd) {
        return res.status(400).json({ error: "token and password required" });
    }

    const tokenHash = hashSessionToken(rawToken);

    try {
        const tokenResult = await query(
            `SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used_at
             FROM password_reset_tokens prt
             WHERE prt.token_hash = $1`,
            [tokenHash]
        );

        if (tokenResult.rowCount === 0) {
            return res.status(400).json({ error: "invalid or expired token" });
        }

        const tokenRow = tokenResult.rows[0];

        if (tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
            return res.status(400).json({ error: "invalid or expired token" });
        }

        const userResult = await query(
            `SELECT id, username, username_display, email, is_admin, created_at, password_hash
             FROM users
             WHERE id = $1`,
            [tokenRow.user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(400).json({ error: "invalid or expired token" });
        }

        const user = userResult.rows[0];
        const error = validatePassword(pwd, user.username, user.email);
        if (error) {
            return res.status(400).json({ error });
        }

        const hashed = await hashPassword(pwd);

        await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashed, user.id]);
        await query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [tokenRow.id]);
        await query(
            `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
            [user.id]
        );

        audit("auth.password_reset.complete", { user_id: user.id, ip: req.ip });
        return res.status(204).send();
    } catch (err) {
        console.error("POST /auth/password-reset/complete error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handleEmailVerifyRequest(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });
    if (req.user.email_verified_at) return res.status(204).send();

    try {
        await query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [userId]);

        const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
        let token = generateSessionToken();
        let tokenHash = hashSessionToken(token);
        try {
            await query(
                `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, $3)`,
                [userId, tokenHash, expiresAt]
            );
        } catch (e) {
            if (e?.code !== "23505") throw e;
            token = generateSessionToken();
            tokenHash = hashSessionToken(token);
            await query(
                `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, $3)`,
                [userId, tokenHash, expiresAt]
            );
        }

        audit("auth.verify_email.request", { user_id: userId, email: req.user.email, ip: req.ip });

        if (process.env.NODE_ENV !== "production") {
            return res.status(200).json({ verify_token: token, expires_in_minutes: EMAIL_VERIFY_TTL_MINUTES });
        }
        return res.status(204).send();
    } catch (err) {
        console.error("POST /auth/email/verify/request error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handleEmailVerifyComplete(req, res) {
    const tokenRaw = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!tokenRaw) return res.status(400).json({ error: "token required" });

    const tokenHash = hashSessionToken(tokenRaw);
    try {
        const tokenRes = await query(
            `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at, u.email
             FROM email_verification_tokens evt
             JOIN users u ON u.id = evt.user_id
             WHERE evt.token_hash = $1`,
            [tokenHash]
        );

        if (
            tokenRes.rowCount === 0 ||
            tokenRes.rows[0].used_at ||
            new Date(tokenRes.rows[0].expires_at) < new Date()
        ) {
            return res.status(400).json({ error: "invalid or expired token" });
        }

        const row = tokenRes.rows[0];
        await query(`UPDATE email_verification_tokens SET used_at = now() WHERE id = $1`, [row.id]);
        await query(`DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL`, [row.user_id]);
        await query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [row.user_id]);

        audit("auth.verify_email.complete", { user_id: row.user_id, email: row.email, ip: req.ip });
        return res.status(204).send();
    } catch (err) {
        console.error("POST /auth/email/verify/complete error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handleChangePassword(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });

    const current = typeof req.body?.current_password === "string" ? req.body.current_password : "";
    const nextPwd = typeof req.body?.new_password === "string" ? req.body.new_password : "";
    if (!current || !nextPwd) {
        return res.status(400).json({ error: "current_password and new_password required" });
    }

    try {
        const userRes = await query(`SELECT password_hash, username, email FROM users WHERE id = $1`, [userId]);
        if (userRes.rowCount === 0) return res.status(401).json({ error: "not authenticated" });

        const ok = await verifyPassword(current, userRes.rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: "invalid current password" });

        const cleanUsername = req.user.username;
        const cleanEmail = req.user.email;
        const err = validatePassword(nextPwd, cleanUsername, cleanEmail);
        if (err) return res.status(400).json({ error: err });
        if (nextPwd === current) return res.status(400).json({ error: "new password must differ from current" });

        const hashed = await hashPassword(nextPwd);
        await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashed, userId]);
        await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);

        audit("auth.password.change", { user_id: userId, ip: req.ip });
        return res.status(204).send();
    } catch (err) {
        console.error("POST /auth/password/change error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

export async function handleDeleteAccount(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });

    try {
        await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
        await query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [userId]);
        await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
        await query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
        await query(`DELETE FROM users WHERE id = $1`, [userId]);

        audit("auth.account.delete", { user_id: userId, ip: req.ip });
        res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
        return res.status(204).send();
    } catch (err) {
        console.error("DELETE /auth/account error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}

// Idempotent logout (OK to call even if not logged in)
export async function handleLogout(req, res) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token === "string" && token.length > 0) {
        try {
            const tokenHash = hashSessionToken(token);
            await query(
                `UPDATE sessions
                 SET revoked_at = now()
                 WHERE token_hash = $1
                   AND revoked_at IS NULL`,
                [tokenHash]
            );
        } catch (err) {
            console.error("POST /auth/logout error", err);
        }
    }

    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
    audit("auth.logout", { user_id: req.user?.id, ip: req.ip });
    return res.status(204).send();
}

export function handleMe(req, res) {
    return res.status(200).json({
        id: req.user.id,
        username: req.user.username,
        username_display: req.user.username_display,
        email: req.user.email,
        email_verified_at: req.user.email_verified_at,
        is_admin: req.user.is_admin,
        roles: Array.isArray(req.user.roles) ? req.user.roles : [],
        created_at: req.user.created_at,
    });
}

export async function handleListSessions(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });
    const result = await query(
        `SELECT id, created_at, expires_at, last_seen_at, revoked_at, user_agent, ip
         FROM sessions
         WHERE user_id = $1
         ORDER BY last_seen_at DESC`,
        [userId]
    );
    return res.json({ sessions: result.rows });
}

export async function handleCurrentSession(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    const tokenHash = token ? hashSessionToken(token) : null;
    if (!tokenHash) return res.status(401).json({ error: "not authenticated" });

    const result = await query(
        `SELECT id, created_at, expires_at, last_seen_at, revoked_at, user_agent, ip
         FROM sessions
         WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
        [userId, tokenHash]
    );
    if (result.rowCount === 0) return res.status(401).json({ error: "not authenticated" });
    return res.json(result.rows[0]);
}

export async function handleRevokeOtherSessions(req, res) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "not authenticated" });
    const currentToken = req.cookies?.[SESSION_COOKIE_NAME];
    const currentHash = currentToken ? hashSessionToken(currentToken) : null;
    if (!currentHash) return res.status(401).json({ error: "not authenticated" });

    await query(
        `UPDATE sessions
         SET revoked_at = now()
         WHERE user_id = $1
           AND token_hash <> $2
           AND revoked_at IS NULL`,
        [userId, currentHash]
    );
    audit("auth.sessions.revoke_others", { user_id: userId, ip: req.ip });
    return res.status(204).send();
}

router.post("/register", handleRegister);
router.post("/login", loginLimiterByIp, loginLimiterByIdentifier, handleLogin);
router.post("/password-reset/request", passwordResetLimiter, handlePasswordResetRequest);
router.post("/password-reset/complete", handlePasswordResetComplete);
router.post("/email/verify/request", requireAuth, handleEmailVerifyRequest);
router.post("/email/verify/complete", handleEmailVerifyComplete);
router.post("/password/change", requireAuth, handleChangePassword);
router.delete("/account", requireAuth, handleDeleteAccount);
router.post("/logout", handleLogout);
router.get("/me", requireAuth, handleMe);
router.get("/sessions", requireAuth, handleListSessions);
router.get("/session", requireAuth, handleCurrentSession);
router.post("/sessions/revoke-others", requireAuth, handleRevokeOtherSessions);

export const authHandlers = {
    register: handleRegister,
    login: handleLogin,
    logout: handleLogout,
    me: handleMe,
    passwordResetRequest: handlePasswordResetRequest,
    passwordResetComplete: handlePasswordResetComplete,
    emailVerifyRequest: handleEmailVerifyRequest,
    emailVerifyComplete: handleEmailVerifyComplete,
    changePassword: handleChangePassword,
    deleteAccount: handleDeleteAccount,
};

export default router;
