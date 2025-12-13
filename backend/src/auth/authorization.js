export function requireRole(roleName) {
    return function (req, res, next) {
        const roles = req.user?.roles || [];
        if (req.user?.is_admin || roles.includes(roleName)) {
            return next();
        }
        return res.status(403).json({ error: "forbidden" });
    };
}

export function hasRole(user, roleName) {
    return Array.isArray(user?.roles) && user.roles.includes(roleName);
}

// Placeholder policy hook for future ABAC/RBAC decisions
// policyFn signature: (req) => { allow: boolean, reason?: string }
export function withPolicy(policyFn) {
    return function (req, res, next) {
        try {
            const decision = policyFn(req);
            if (decision?.allow) return next();
            return res.status(403).json({ error: decision?.reason || "forbidden" });
        } catch (err) {
            return res.status(500).json({ error: "internal server error" });
        }
    };
}
