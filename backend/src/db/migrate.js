import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));
const pool = new Pool({
  connectionString: env.migrationDatabaseUrl(),
  ssl: env.databaseSsl,
  max: 1,
  application_name: "nublue-migrations",
});

try {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('nublue:migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const version = path.basename(filename, ".sql");
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (applied.rowCount) continue;

      const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
        process.stdout.write(`Applied ${version}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('nublue:migrations'))");
    client.release();
  }
} finally {
  await pool.end();
}
