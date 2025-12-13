import os from "node:os";

let requestsTotal = 0;
let errorsTotal = 0;

export function recordRequest() {
    requestsTotal += 1;
}

export function recordError() {
    errorsTotal += 1;
}

export function snapshotMetrics() {
    const mem = process.memoryUsage();
    return {
        service: "logs-backend",
        pid: process.pid,
        uptime_seconds: Math.round(process.uptime()),
        hostname: os.hostname(),
        requests_total: requestsTotal,
        errors_total: errorsTotal,
        memory_rss_bytes: mem.rss,
        memory_heap_used_bytes: mem.heapUsed,
        memory_heap_total_bytes: mem.heapTotal,
        event_loop_delay_ms: 0, // placeholder for future histograms
    };
}
