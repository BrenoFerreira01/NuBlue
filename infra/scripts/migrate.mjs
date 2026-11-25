// Uso: node infra/scripts/migrate.mjs up|down
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { getConnectionConfig } from "../db-config.mjs";

const direction = process.argv[2];
if (direction !== "up" && direction !== "down") {
  console.error("Uso: node infra/scripts/migrate.mjs up|down");
  process.exit(1);
}

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

try {
  const applied = await runner({
    databaseUrl: getConnectionConfig({ migration: true }),
    dir: migrationsDir,
    direction,
    count: direction === "down" ? 1 : Infinity,
    migrationsTable: "pgmigrations",
    checkOrder: true,
    log: () => {},
  });
  const names = applied.map((migration) => path.basename(migration.path));
  console.log(
    names.length
      ? `Migrações (${direction}): ${names.join(", ")}`
      : "Nenhuma migração pendente.",
  );
} catch (error) {
  console.error("Falha nas migrações:", error.message);
  process.exit(1);
}
