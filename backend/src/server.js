import { env } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { purgeExpiredData } from "./db/maintenance.js";
import { createApiServer } from "./app.js";

const maintenanceIntervalMs = 60 * 60_000;

const pool = createPool();
const server = createApiServer(pool);

async function runMaintenance() {
  try {
    const removed = await purgeExpiredData(pool);
    process.stdout.write(
      `Maintenance: removed ${removed.sessions} expired sessions, ${removed.rateLimitBuckets} rate-limit windows\n`,
    );
  } catch {
    process.stderr.write("Maintenance failed; will retry on the next interval\n");
  }
}

server.listen(env.port, () => {
  process.stdout.write(`Nublue API listening on port ${env.port} (rate limit: ${env.rateLimitStore})\n`);
  runMaintenance();
});

const maintenanceTimer = setInterval(runMaintenance, maintenanceIntervalMs);
maintenanceTimer.unref();

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(maintenanceTimer);
  // Stop accepting connections; force exit if keep-alive clients hold it open.
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
