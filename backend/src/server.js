import { env } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { describePurge, purgeExpiredData } from "./db/maintenance.js";
import { createApiServer } from "./app.js";
import { createMailer } from "./email.js";

const maintenanceIntervalMs = 60 * 60_000;

// Migrations and seeds share env.js but never send e-mail, so only the API requires it.
if (env.isProduction && !env.resendApiKey) {
  throw new Error("RESEND_API_KEY is required in production: new accounts must confirm their e-mail");
}

const pool = createPool();
const server = createApiServer(pool, {
  mailer: createMailer({ resendApiKey: env.resendApiKey, from: env.emailFrom }),
});

async function runMaintenance() {
  try {
    const removed = await purgeExpiredData(pool);
    process.stdout.write(`Maintenance: ${describePurge(removed)}\n`);
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
