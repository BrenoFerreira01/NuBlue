import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env } from "../config/env.js";
import { withTransaction } from "./pool.js";

const { Pool } = pg;
const catalogPath = fileURLToPath(new URL("../data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const pool = new Pool({
  connectionString: env.migrationDatabaseUrl(),
  ssl: env.databaseSsl,
  max: 1,
  application_name: "nublue-course-seed",
});

const privateKeys = new Set(["answerKey", "source"]);
const levels = [...catalog.levels, catalog.bonus];

try {
  await withTransaction(pool, async (client) => {
    for (const level of levels) {
      const publicData = Object.fromEntries(
        Object.entries(level).filter(([key]) => !privateKeys.has(key)),
      );
      await client.query(
        `INSERT INTO course_levels
          (id, chapter, unit, lesson, content_version, public_data, answer_key, is_bonus, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now())
         ON CONFLICT (id) DO UPDATE SET
          chapter = EXCLUDED.chapter,
          unit = EXCLUDED.unit,
          lesson = EXCLUDED.lesson,
          content_version = EXCLUDED.content_version,
          public_data = EXCLUDED.public_data,
          answer_key = EXCLUDED.answer_key,
          is_bonus = EXCLUDED.is_bonus,
          updated_at = now()`,
        [
          level.id,
          level.chapter,
          level.unit,
          level.session,
          catalog.version,
          JSON.stringify(publicData),
          JSON.stringify(level.answerKey),
          level.isBonus,
        ],
      );
    }
  });
  process.stdout.write(`Seeded ${catalog.levels.length} course levels and ${catalog.bonus.title}\n`);
} finally {
  await pool.end();
}
