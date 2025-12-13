import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordError, recordRequest, snapshotMetrics } from "./metrics/metrics.js";
import { readFile } from "node:fs/promises";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: true, // echo request origin
        credentials: true, // allow cookie credentials for same-site dev tools like Swagger
    })
);
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
