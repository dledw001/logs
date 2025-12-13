import express from 'express';
import cors from 'cors';
import helmet from "helmet";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordError, recordRequest, snapshotMetrics } from "./metrics/metrics.js";
import { readFile } from "node:fs/promises";
import pinoHttp from "pino-http";
import pino from "pino";
import fs from "node:fs";
import { query } from "./db/db.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

const isProd = process.env.NODE_ENV === "production";
const accessLogPath = process.env.ACCESS_LOG_FILE || path.join(__dirname, "..", "access.log");
const auditLogPath = process.env.AUDIT_LOG_FILE || path.join(__dirname, "..", "audit.log");
const logLevel = process.env.LOG_LEVEL || "info";
const accessLogEnabled = process.env.ACCESS_LOG_ENABLED !== "false";
const accessLogConsole = process.env.LOG_CONSOLE !== "false" && process.env.NODE_ENV !== "test";

function createRotatingStream(filePath) {
    const maxBytes = Number(process.env.LOG_MAX_BYTES || 5 * 1024 * 1024); // 5MB default
    function rotateIfNeeded() {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size >= maxBytes) {
                const rotated = `${filePath}.${Date.now()}`;
                fs.renameSync(filePath, rotated);
            }
        } catch (err) {
            // ignore if file doesn't exist yet
        }
    }

    return {
        write(chunk) {
            rotateIfNeeded();
            fs.appendFile(filePath, chunk, (err) => {
                if (err) {
                    // eslint-disable-next-line no-console
                    console.error("Failed to write log", err);
                }
            });
        },
    };
}

const streams = [];
if (accessLogConsole) streams.push({ stream: process.stdout });
if (accessLogEnabled) streams.push({ stream: createRotatingStream(accessLogPath) });
const logger = pino({ level: logLevel }, streams.length ? pino.multistream(streams) : process.stdout);

app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return cb(null, true);
            }
            return cb(new Error("CORS not allowed"), false);
        },
        credentials: true,
    })
);
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"], // allow inline + CDN for Swagger UI
            "img-src": ["'self'", "data:"],
            "connect-src": ["'self'"],
        },
    },
    hsts: isProd,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
}));
app.use(pinoHttp({ logger }));
app.use(express.static(publicDir));

app.use((req, _res, next) => {
    req.id = crypto.randomUUID();
    recordRequest();
    req.startTime = Date.now();
    next();
});

export function handleHealth(_req, res) {
    res.json({ service: 'logs-backend', status: 'ok'});
}

export function handleMetrics(_req, res) {
    res.json(snapshotMetrics());
}

export async function handleReady(_req, res) {
    try {
        await query("SELECT 1");
        return res.json({ service: "logs-backend", status: "ready" });
    } catch (err) {
        return res.status(503).json({ service: "logs-backend", status: "degraded", error: "db_unreachable" });
    }
}

export function handleDocs(_req, res) {
    res.sendFile(path.join(publicDir, "docs.html"));
}

export async function handleOpenApi(_req, res) {
    const filePath = path.join(publicDir, "openapi.json");
    const data = await readFile(filePath, "utf-8");
    res.type("application/json").send(data);
}

export function handleConfig(_req, res) {
    res.json({
        session: {
            max_per_user: Number(process.env.SESSION_MAX_PER_USER || 5),
            idle_timeout_minutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 30),
            ttl_days: Number(process.env.SESSION_TTL_DAYS || 7),
            rolling_renewal_minutes: Number(process.env.SESSION_ROLLING_RENEWAL_MINUTES || 60 * 24),
        },
        rate_limits: {
            login_ip_max: Number(process.env.LOGIN_LIMIT_IP_MAX || 10),
            login_id_max: Number(process.env.LOGIN_LIMIT_ID_MAX || 7),
            login_window_ms: Number(process.env.LOGIN_LIMIT_WINDOW_MS || 15 * 60 * 1000),
            reset_max: Number(process.env.RESET_LIMIT_MAX || 5),
            reset_window_ms: Number(process.env.RESET_LIMIT_WINDOW_MS || 60 * 60 * 1000),
        },
    });
}

app.get('/health', handleHealth);
app.get('/metrics', handleMetrics);
app.get('/ready', handleReady);
app.get('/', (_req, res) => res.redirect('/docs'));
app.get('/docs', handleDocs);
app.get('/api/docs', (_req, res) => res.redirect('/docs'));
app.get('/api/config', handleConfig);

app.get('/openapi.json', handleOpenApi);
app.get('/api/openapi.json', handleOpenApi);

import router from './routes/index.js';
app.use('/api', router);

// Structured error handler for uncaught errors
app.use((err, req, res, _next) => {
    recordError();
    const payload = {
        ts: new Date().toISOString(),
        event: "request.error",
        request_id: req.id,
        path: req.path,
        method: req.method,
        message: err?.message || "internal error",
    };
    console.error(JSON.stringify(payload));
    res.status(500).json({ error: "internal server error", request_id: req.id });
});

export default app;
