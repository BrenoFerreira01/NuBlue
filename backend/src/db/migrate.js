import pg from "pg";
import { env } from "../config/env.js";
import { runMigrations } from "./migrations-runner.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: env.migrationDatabaseUrl(),
  ssl: env.databaseSsl,
  max: 1,
  application_name: "nublue-migrations",
});

try {
  const client = await pool.connect();
  try {
    await runMigrations(client, { log: (message) => process.stdout.write(`${message}\n`) });
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
