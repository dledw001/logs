import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const AUDIT_ENABLED = process.env.AUDIT_LOG_ENABLED !== "false";
const AUDIT_LOG_CONSOLE = process.env.AUDIT_LOG_CONSOLE === "true";
const AUDIT_LOG_FILE = process.env.AUDIT_LOG_FILE || path.join(process.cwd(), "audit.log");

let ensuredDir = false;

async function ensureDir() {
    if (ensuredDir) return;
    ensuredDir = true;
    const dir = path.dirname(AUDIT_LOG_FILE);
    await mkdir(dir, { recursive: true });
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
        await appendFile(AUDIT_LOG_FILE, line + "\n");
    } catch (err) {
        console.error("audit log write failed", err);
    }
}

export function audit(event, meta = {}) {
    if (!AUDIT_ENABLED) return;
    const payload = {
        ts: new Date().toISOString(),
        event,
        ...cleanMeta(meta),
    };
    const line = JSON.stringify(payload);
    if (AUDIT_LOG_CONSOLE) {
        console.log(line);
    }
    // fire-and-forget write
    void writeToFile(line);
}
