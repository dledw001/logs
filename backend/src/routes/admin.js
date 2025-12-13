import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../auth/authorization.js";

export function handleAdminPing(req, res) {
    res.status(200).json({ ok: true, user_id: req.user.id });
}

const router = Router();
router.get("/ping", requireAuth, requireRole("admin"), handleAdminPing);

export default router;
