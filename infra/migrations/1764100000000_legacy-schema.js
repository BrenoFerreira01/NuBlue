// Esquema herdado do backend anterior (infra/legacy-sql/*.sql), que registrava
// as versões aplicadas na tabela schema_migrations. Esta migração aplica só os
// arquivos que ainda não constam lá: um banco novo recebe tudo; um banco já em
// produção (copiado do PlanetScale) não roda nenhum DDL de novo.

const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");

const LEGACY_DIR = path.join(__dirname, "..", "legacy-sql");

exports.up = async (pgm) => {
  await pgm.db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = new Set(
    (await pgm.db.select("SELECT version FROM schema_migrations")).map(
      (row) => row.version,
    ),
  );

  for (const file of readdirSync(LEGACY_DIR).sort()) {
    const version = path.basename(file, ".sql");
    if (applied.has(version)) continue;
    pgm.sql(readFileSync(path.join(LEGACY_DIR, file), "utf8"));
    pgm.sql(`INSERT INTO schema_migrations (version) VALUES ('${version}')`);
  }
};

// O esquema herdado não é desfeito: apagaria os dados dos alunos.
exports.down = false;
