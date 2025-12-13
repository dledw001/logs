import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "sid";
export const SESSION_TTL_DAYS = 7;
export const SESSION_IDLE_TIMEOUT_MINUTES = 30;
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;

export function generateSessionToken() {
    // 32 bytes => 64 hex chars
    return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token) {
    // store hash in DB; cookie keeps raw token
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function cookieOptions() {
    const isProd = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProd,           // true behind HTTPS in prod
        sameSite: "lax",          // decent baseline for browser apps
        path: "/",
        // maxAge set when you set the cookie
    };
}
