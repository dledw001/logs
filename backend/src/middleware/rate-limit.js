// Simple in-memory rate limiter for small deployments and tests.
// For production, swap to a shared store (Redis, Memcached, etc.).

function defaultKey(req) {
    return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}

export function createRateLimiter({
    windowMs,
    max,
    blockDurationMs,
    keyGenerator = defaultKey,
    name = "rate-limit",
} = {}) {
    const attempts = new Map();

    function prune(key) {
        const entry = attempts.get(key);
        if (!entry) return;
        const now = Date.now();
        entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
        if (entry.blockUntil && entry.blockUntil <= now) {
            delete entry.blockUntil;
        }
        if (entry.timestamps.length === 0 && !entry.blockUntil) {
            attempts.delete(key);
        }
    }

    return function rateLimiter(req, res, next) {
        const key = keyGenerator(req);
        const now = Date.now();
        prune(key);

        const entry = attempts.get(key) || { timestamps: [] };

        if (entry.blockUntil && entry.blockUntil > now) {
            const retryAfterSec = Math.ceil((entry.blockUntil - now) / 1000);
            res.setHeader("Retry-After", retryAfterSec);
            return res.status(429).json({ error: `${name} temporarily blocked` });
        }

        entry.timestamps.push(now);
        attempts.set(key, entry);

        if (entry.timestamps.length > max) {
            entry.blockUntil = now + blockDurationMs;
            const retryAfterSec = Math.ceil(blockDurationMs / 1000);
            res.setHeader("Retry-After", retryAfterSec);
            return res.status(429).json({ error: `${name} temporarily blocked` });
        }

        return next();
    };
}
