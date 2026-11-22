import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env } from "../config/env.js";
import { seedCourse } from "./seed.js";

const { Pool } = pg;
const catalogPath = fileURLToPath(new URL("../data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const pool = new Pool({
  connectionString: env.migrationDatabaseUrl(),
  ssl: env.databaseSsl,
  max: 1,
  application_name: "nublue-course-seed",
});

try {
  await seedCourse(pool, catalog);
  const bonusNote = catalog.bonus ? ` and ${catalog.bonus.title}` : " (bonus disabled)";
  process.stdout.write(`Seeded ${catalog.levels.length} course levels${bonusNote}\n`);
} finally {
  await pool.end();
}
