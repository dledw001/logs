export function requireRole(roleName) {
    return function (req, res, next) {
        const roles = req.user?.roles || [];
        if (!roles.includes(roleName)) {
            return res.status(403).json({ error: "forbidden" });
        }
        return next();
    };
}

export function hasRole(user, roleName) {
    return Array.isArray(user?.roles) && user.roles.includes(roleName);
}
