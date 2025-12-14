import path from "node:path";

// Lazy-load fs/promises so tests can mock it via jest.unstable_mockModule
const fsPromise = import("node:fs/promises");
const AUDIT_DB_ENABLED =
    process.env.AUDIT_DB_ENABLED !== undefined
        ? process.env.AUDIT_DB_ENABLED !== "false"
        : true;
const ALLOW_DB_IN_TEST = process.env.AUDIT_DB_ENABLED === "true";

const AUDIT_ENABLED = process.env.AUDIT_LOG_ENABLED !== "false";
const AUDIT_LOG_CONSOLE = process.env.AUDIT_LOG_CONSOLE === "true";
const AUDIT_LOG_FILE = process.env.AUDIT_LOG_FILE || path.join(process.cwd(), "audit.log");
const AUDIT_LOG_MAX_BYTES = Number(process.env.AUDIT_LOG_MAX_BYTES || 5 * 1024 * 1024);

let ensuredDir = false;

async function ensureDir() {
    if (ensuredDir) return;
    ensuredDir = true;
    const dir = path.dirname(AUDIT_LOG_FILE);
    const fs = await fsPromise;
    await fs.mkdir(dir, { recursive: true });
}

function cleanMeta(meta = {}) {
    const cloned = {};
    for (const [key, value] of Object.entries(meta)) {
        if (value === undefined) continue;
        // Never log secrets
        if (key.toLowerCase().includes("password") || key.toLowerCase().includes("token")) {
            cloned[key] = "[redacted]";
            continue;
        }
        cloned[key] = value instanceof Error ? value.message : value;
    }
    return cloned;
}

async function writeToFile(line) {
    try {
        await ensureDir();
        try {
            await renameIfNeeded();
        } catch {
            // ignore rotation errors, best-effort
        }
        const fs = await fsPromise;
        await fs.appendFile(AUDIT_LOG_FILE, line + "\n");
    } catch (err) {
        console.error("audit log write failed", err);
    }
}

async function renameIfNeeded(force = false) {
    try {
        const fs = await fsPromise;
        const stats = await fs.stat(AUDIT_LOG_FILE);
        if ((force || stats?.size >= AUDIT_LOG_MAX_BYTES) && typeof fs.rename === "function") {
            const rotated = `${AUDIT_LOG_FILE}.${Date.now()}`;
            await fs.rename(AUDIT_LOG_FILE, rotated);
        }
        return stats;
    } catch {
        return null;
    }
}

export function audit(event, meta = {}) {
    if (!AUDIT_ENABLED) return;
    const payload = buildPayload(event, meta);
    const line = JSON.stringify(payload);
    if (AUDIT_LOG_CONSOLE) {
        console.log(line);
    }
    // fire-and-forget write
    void writeToFile(line);
    if (AUDIT_DB_ENABLED && (process.env.NODE_ENV !== "test" || ALLOW_DB_IN_TEST)) {
        void writeToDb(event, payload);
    }
}

export async function auditAndWait(event, meta = {}) {
    if (!AUDIT_ENABLED) return;
    const payload = buildPayload(event, meta);
    const line = JSON.stringify(payload);
    if (AUDIT_LOG_CONSOLE) {
        console.log(line);
    }
    await writeToFile(line);
    if (AUDIT_DB_ENABLED && (process.env.NODE_ENV !== "test" || ALLOW_DB_IN_TEST)) {
        await writeToDb(event, payload);
    }
}

function buildPayload(event, meta) {
    const cleaned = cleanMeta(meta);
    return {
        ts: new Date().toISOString(),
        event,
        ...cleaned,
    };
}

async function writeToDb(event, payload) {
    try {
        const mod = await import("../db/db.js");
        const userId = payload.user_id ?? null;
        const username = payload.username ?? null;
        const email = payload.email ?? null;
        const ip = payload.ip ?? null;
        const meta = { ...payload };
        delete meta.ts;
        delete meta.event;
        delete meta.user_id;
        delete meta.username;
        delete meta.email;
        delete meta.ip;
        await mod.query(
            `INSERT INTO audit_log (ts, event, user_id, username, email, ip, meta)
             VALUES (now(), $1, $2, $3, $4, $5, $6)`,
            [event, userId, username, email, ip, meta]
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("audit db write failed", err);
    }
}
