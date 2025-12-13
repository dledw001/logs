import { query } from "../db/db.js";
import { hashSessionToken, SESSION_COOKIE_NAME, SESSION_IDLE_TIMEOUT_MS } from "../auth/session.js";

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.[SESSION_COOKIE_NAME];
        if (!token) return res.status(401).json({ error: "not authenticated" });

        const tokenHash = hashSessionToken(token);

        const result = await query(
            `SELECT s.user_id,
                    s.expires_at,
                    s.last_seen_at,
                    u.id,
                    u.username,
                    u.username_display,
                    u.email,
                    u.email_verified_at,
                    u.is_admin,
                    u.created_at,
                    COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN roles r ON r.id = ur.role_id
             WHERE s.token_hash = $1
               AND s.revoked_at IS NULL
             AND s.expires_at > now()
             GROUP BY s.user_id, s.expires_at, s.last_seen_at, u.id, u.username, u.username_display, u.email, u.email_verified_at, u.is_admin, u.created_at`,
            [tokenHash]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "not authenticated" });
        }

        const session = result.rows[0];

        const idleDeadline = new Date(new Date(session.last_seen_at).getTime() + SESSION_IDLE_TIMEOUT_MS);
        if (idleDeadline <= new Date()) {
            await query(
                `UPDATE sessions
                 SET revoked_at = now()
                 WHERE token_hash = $1
                   AND revoked_at IS NULL`,
                [tokenHash]
            );
            return res.status(401).json({ error: "not authenticated" });
        }

        await query(`UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1`, [tokenHash]);

        req.user = session;
        return next();
    } catch (err) {
        console.error("requireAuth error", err);
        return res.status(500).json({ error: "internal server error" });
    }
}
