// Grava o catálogo do curso (infra/data/course-catalog.json) na tabela
// course_levels. Idempotente: roda a cada deploy.
// Uso: node infra/scripts/seed.mjs [caminho-do-catalogo.json]
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getConnectionConfig } from "../db-config.mjs";
import { assertValidCatalog } from "../catalog-validation.mjs";

// Campos que nunca vão para o navegador.
const PRIVATE_KEYS = new Set(["answerKey", "source"]);

function withoutPrivate(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => !PRIVATE_KEYS.has(key)),
  );
}

/** Nível sem respostas: cada versão leva só grade, lacunas e banco. */
function publicLevelData(level) {
  const variants = Object.fromEntries(
    Object.entries(level.variants).map(([difficulty, variant]) => [
      difficulty,
      { ...variant, puzzles: variant.puzzles.map(withoutPrivate) },
    ]),
  );
  return { ...withoutPrivate(level), variants };
}

/** { easy: [4 chaves], medium: [...], hard: [...] } */
function answerKeyOf(level) {
  return Object.fromEntries(
    Object.entries(level.variants).map(([difficulty, variant]) => [
      difficulty,
      variant.puzzles.map((puzzle) => puzzle.answerKey),
    ]),
  );
}

const catalogPath =
  process.argv[2] ??
  fileURLToPath(new URL("../data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

try {
  assertValidCatalog(catalog);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const levels = catalog.bonus
  ? [...catalog.levels, catalog.bonus]
  : catalog.levels;
const client = new pg.Client(getConnectionConfig({ migration: true }));
await client.connect();

try {
  await client.query("BEGIN");
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
        JSON.stringify(answerKeyOf(level)),
        level.isBonus,
      ],
    );
  }
  await client.query("COMMIT");
  const bonus = catalog.bonus
    ? ` e ${catalog.bonus.title}`
    : " (bônus desativado)";
  console.log(`Catálogo semeado: ${catalog.levels.length} níveis${bonus}.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Falha ao semear o catálogo:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
