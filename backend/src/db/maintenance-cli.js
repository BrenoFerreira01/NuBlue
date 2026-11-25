// One-off cleanup for hosts that run scheduled jobs (cron). The API also runs it
// hourly by itself, so this is optional.
import { createPool } from "./pool.js";
import { describePurge, purgeExpiredData } from "./maintenance.js";

const pool = createPool();
try {
  process.stdout.write(`Maintenance: ${describePurge(await purgeExpiredData(pool))}\n`);
} finally {
  await pool.end();
}
