// One-off cleanup for hosts that run scheduled jobs (cron). The API also runs it
// hourly by itself, so this is optional.
import { createPool } from "./pool.js";
import { purgeExpiredData } from "./maintenance.js";

const pool = createPool();
try {
  const removed = await purgeExpiredData(pool);
  process.stdout.write(
    `Removed ${removed.sessions} expired sessions and ${removed.rateLimitBuckets} rate-limit windows\n`,
  );
} finally {
  await pool.end();
}
