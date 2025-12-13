import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import app from './app.js';
import { pool } from "./db/db.js";

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
   console.log(`logs backend listening on http://localhost:${PORT}`);
});

let shuttingDown = false;
async function shutdown(reason = "signal") {
   if (shuttingDown) return;
   shuttingDown = true;
   console.log(`Shutting down (${reason})...`);
   server.close(() => {
      console.log("HTTP server closed");
   });
   try {
      await pool.end();
      console.log("Database pool closed");
   } catch (err) {
      console.error("Error closing database pool", err);
   } finally {
      process.exit(0);
   }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
