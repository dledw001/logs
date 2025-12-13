import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Tighter rate limits for tests
process.env.LOGIN_LIMIT_IP_MAX = process.env.LOGIN_LIMIT_IP_MAX || "2";
process.env.LOGIN_LIMIT_ID_MAX = process.env.LOGIN_LIMIT_ID_MAX || "2";
process.env.LOGIN_LIMIT_WINDOW_MS = process.env.LOGIN_LIMIT_WINDOW_MS || String(5 * 1000);
process.env.LOGIN_LIMIT_BLOCK_MS = process.env.LOGIN_LIMIT_BLOCK_MS || String(30 * 1000);

// Quiet noisy logs during tests
process.env.LOG_CONSOLE = process.env.LOG_CONSOLE || "false";
process.env.ACCESS_LOG_ENABLED = process.env.ACCESS_LOG_ENABLED || "false";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "warn";
process.env.AUDIT_DB_ENABLED = process.env.AUDIT_DB_ENABLED || "false";
