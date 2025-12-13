import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { withPolicy } from "../auth/authorization.js";

// Example ABAC policy: allow if user is admin or has "beta" role
const allowBeta = (req) => {
    if (req.user?.is_admin || req.user?.roles?.includes("beta")) {
        return { allow: true };
    }
    return { allow: false, reason: "beta access required" };
};

const router = Router();
router.get("/", requireAuth, withPolicy(allowBeta), (req, res) => {
    res.json({ message: `Hello ${req.user.username_display || req.user.username}` });
});

export default router;
