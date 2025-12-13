import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../auth/authorization.js";
import { query } from "../db/db.js";
import { audit } from "../logger/audit.js";

export function handleAdminPing(req, res) {
    res.status(200).json({ ok: true, user_id: req.user.id });
}

export async function handleAdminUsers(req, res) {
    const result = await query(
        `SELECT u.id,
                u.username,
                u.username_display,
                u.email,
                u.email_verified_at,
                u.is_admin,
                u.created_at,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id, u.username, u.username_display, u.email, u.email_verified_at, u.is_admin, u.created_at
         ORDER BY u.id ASC`
    );
    audit("admin.users.list", { user_id: req.user.id, count: result.rowCount, ip: req.ip });
    res.json({ users: result.rows });
}

export async function handleAdminUpdateRoles(req, res) {
    const targetId = Number(req.params.userId);
    const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];

    if (!targetId || roles.length === 0 || roles.some((r) => typeof r !== "string")) {
        return res.status(400).json({ error: "roles array required" });
    }

    // fetch available roles
    const roleResult = await query(`SELECT id, name FROM roles WHERE name = ANY($1::text[])`, [roles]);
    if (roleResult.rowCount !== roles.length) {
        return res.status(400).json({ error: "one or more roles invalid" });
    }

    // prevent self-demotion of last admin
    if (req.user.id === targetId && !roles.includes("admin")) {
        return res.status(400).json({ error: "cannot remove own admin role" });
    }

    // clear existing roles then insert new
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [targetId]);
    for (const roleRow of roleResult.rows) {
        await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
            targetId,
            roleRow.id,
        ]);
    }

    const isAdmin = roles.includes("admin");
    await query(`UPDATE users SET is_admin = $2 WHERE id = $1`, [targetId, isAdmin]);

    const updated = await query(
        `SELECT u.id,
                u.username,
                u.username_display,
                u.email,
                u.is_admin,
                u.created_at,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id, u.username, u.username_display, u.email, u.is_admin, u.created_at`,
        [targetId]
    );

    if (!updated.rowCount) {
        return res.status(404).json({ error: "user not found" });
    }

    audit("admin.users.update_roles", {
        actor_id: req.user.id,
        target_id: targetId,
        roles,
        ip: req.ip,
    });

    return res.json(updated.rows[0]);
}

const router = Router();
router.get("/ping", requireAuth, requireRole("admin"), handleAdminPing);
router.get("/users", requireAuth, requireRole("admin"), handleAdminUsers);
router.put("/users/:userId/roles", requireAuth, requireRole("admin"), handleAdminUpdateRoles);

export default router;
