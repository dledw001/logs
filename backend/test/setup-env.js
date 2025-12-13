import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Tighter rate limits for tests
process.env.LOGIN_LIMIT_IP_MAX = process.env.LOGIN_LIMIT_IP_MAX || "2";
process.env.LOGIN_LIMIT_ID_MAX = process.env.LOGIN_LIMIT_ID_MAX || "2";
process.env.LOGIN_LIMIT_WINDOW_MS = process.env.LOGIN_LIMIT_WINDOW_MS || String(5 * 1000);
process.env.LOGIN_LIMIT_BLOCK_MS = process.env.LOGIN_LIMIT_BLOCK_MS || String(30 * 1000);
