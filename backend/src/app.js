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
import { query } from "./db/db.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);

const isProd = process.env.NODE_ENV === "production";
const accessLogDestination = process.env.ACCESS_LOG_FILE || path.join(__dirname, "..", "access.log");
const logger = pino({
    level: process.env.LOG_LEVEL || "info",
}, pino.destination({ dest: accessLogDestination, minLength: 4096, sync: false }));

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
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"], // allow inline for Swagger UI
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

app.get('/health', handleHealth);
app.get('/metrics', handleMetrics);
app.get('/ready', handleReady);
app.get('/', (_req, res) => res.redirect('/docs'));
app.get('/docs', handleDocs);
app.get('/api/docs', (_req, res) => res.redirect('/docs'));

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
