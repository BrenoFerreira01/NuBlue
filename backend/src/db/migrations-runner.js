import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const migrationsDirectory = fileURLToPath(new URL("./migrations/", import.meta.url));

export async function listMigrationVersions() {
  return (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.basename(name, ".sql"));
}

export async function runMigrations(client, { log = () => {} } = {}) {
  await client.query("SELECT pg_advisory_lock(hashtext('nublue:migrations'))");
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const version of await listMigrationVersions()) {
      const filename = `${version}.sql`;
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
        log(`Applied ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('nublue:migrations'))");
  }
}
