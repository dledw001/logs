import crypto from "node:crypto";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function issueCsrfToken(res) {
    const token = crypto.randomBytes(16).toString("hex");
    const isProd = process.env.NODE_ENV === "production";

    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // must be readable by the browser to echo in header
        sameSite: "lax",
        secure: isProd,
        path: "/",
    });

    return token;
}

export function csrfProtection({ skipPaths = [] } = {}) {
    return function csrfGuard(req, res, next) {
        if (SAFE_METHODS.has(req.method)) return next();

        const shouldSkip = skipPaths.some((p) => req.path.startsWith(p));
        if (shouldSkip) return next();

        const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
        const headerToken = req.headers[CSRF_HEADER_NAME] || req.get?.(CSRF_HEADER_NAME);

        if (!cookieToken || !headerToken || cookieToken !== headerToken) {
            return res.status(403).json({ error: "invalid CSRF token" });
        }

        return next();
    };
}
