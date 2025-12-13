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
