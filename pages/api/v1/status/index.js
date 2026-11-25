import database from "infra/database.js";
import { createHandler } from "infra/controller.js";

// Migração mais recente que esta versão do código espera encontrar.
const EXPECTED_MIGRATION = "1764100000000_legacy-schema";

async function databaseStatus() {
  try {
    const result = await database.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_tables WHERE tablename = 'pgmigrations'
       ) AS has_table`,
    );
    if (!result.rows[0].has_table)
      return { status: "healthy", schema: "outdated" };
    const applied = await database.query(
      "SELECT 1 FROM pgmigrations WHERE name = $1",
      [EXPECTED_MIGRATION],
    );
    return {
      status: "healthy",
      schema: applied.rowCount ? "ok" : "outdated",
    };
  } catch {
    return { status: "unavailable", schema: "unknown" };
  }
}

async function getStatus(req, res) {
  const db = await databaseStatus();
  const ok = db.status === "healthy" && db.schema === "ok";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    updated_at: new Date().toISOString(),
    dependencies: { database: db },
  });
}

export default createHandler({ GET: getStatus });
