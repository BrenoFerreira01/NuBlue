import { env } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { createApiServer } from "./app.js";

const pool = createPool();
const server = createApiServer(pool);

server.listen(env.port, () => {
  process.stdout.write(`Nublue API listening on port ${env.port}\n`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
