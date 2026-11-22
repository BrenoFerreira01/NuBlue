import { assertValidCatalog } from "../catalog/validate.js";
import { withTransaction } from "./pool.js";

const privateKeys = new Set(["answerKey", "source"]);

export function publicLevelData(level) {
  return Object.fromEntries(Object.entries(level).filter(([key]) => !privateKeys.has(key)));
}

export async function seedCourse(pool, catalog) {
  assertValidCatalog(catalog);
  const levels = catalog.bonus ? [...catalog.levels, catalog.bonus] : catalog.levels;
  await withTransaction(pool, async (client) => {
    for (const level of levels) {
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
          JSON.stringify(publicLevelData(level)),
          JSON.stringify(level.answerKey),
          level.isBonus,
        ],
      );
    }
  });
  return levels.length;
}
