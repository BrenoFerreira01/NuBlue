// Gera o catálogo versão 4 a partir do catálogo atual: cada nível ganha as
// versões Iniciante, Intermediário e Avançado, com 4 cruzadinhas cada.
// Determinístico: rodar de novo sobre a mesma entrada gera o mesmo arquivo.
// Uso: node infra/scripts/author-catalog.mjs [caminho-do-catalogo.json]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PUZZLES_PER_LESSON,
  countStalls,
  findEquations,
  validateCatalog,
} from "../catalog-validation.mjs";
import {
  TRACKS,
  TRACK_IDS,
  sessionMinStalls,
  variantXp,
} from "../../lib/game/tracks.mjs";
import { generateTrackPuzzle } from "../../lib/game/trackPuzzle.mjs";

const TRACK_LETTER = { easy: "b", medium: "i", hard: "a" };
const PUZZLE_FIELDS = ["grid", "inputIds", "bank", "answerKey"];
const pad = (value) => String(value).padStart(2, "0");

const catalogPath =
  process.argv[2] ??
  fileURLToPath(new URL("../data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

const operationsOf = (grid) => [
  ...new Set(
    grid
      .flat()
      .filter((cell) => cell?.type === "operator")
      .map((cell) => cell.value),
  ),
];

/** Renomeia as lacunas para lNN-<faixa><cruzadinha>-MM. */
function withLessonIds(puzzle, levelId, track, index) {
  const ids = Object.fromEntries(
    puzzle.inputIds.map((old, i) => [
      old,
      `l${pad(levelId)}-${TRACK_LETTER[track]}${index + 1}-${pad(i + 1)}`,
    ]),
  );
  const answers = puzzle.answerKey ?? puzzle.answers;
  return {
    grid: puzzle.grid.map((row) =>
      row.map((cell) =>
        cell?.inputId ? { ...cell, inputId: ids[cell.inputId] } : cell,
      ),
    ),
    inputIds: puzzle.inputIds.map((old) => ids[old]),
    bank: puzzle.bank,
    answerKey: Object.fromEntries(
      Object.entries(answers).map(([old, value]) => [ids[old], value]),
    ),
  };
}

/** A grade atual (versão 3) vira a 1ª cruzadinha do Intermediário quando segue as regras. */
function fitsIntermediate(level) {
  const rules = TRACKS.medium;
  const values = level.grid
    .flat()
    .filter((cell) => cell?.type === "number")
    .map((cell) => cell.value ?? level.answerKey[cell.inputId]);
  const stalls = countStalls(findEquations(level.grid), level.inputIds);
  return (
    level.inputIds.length >= rules.blanks[0] &&
    level.inputIds.length <= rules.blanks[1] &&
    Math.max(...values) <= rules.maxValue &&
    stalls <= rules.stalls.max
  );
}

function authorLevel(level) {
  if (level.variants) return level;
  const operations = operationsOf(level.grid);
  const reuseCurrent = fitsIntermediate(level);
  const variants = {};
  for (const track of TRACK_IDS) {
    const puzzles = [];
    for (let index = 0; index < PUZZLES_PER_LESSON; index += 1) {
      const source =
        track === "medium" && index === 0 && reuseCurrent
          ? level
          : generateTrackPuzzle({
              operations,
              track,
              seed: `${level.id}-${track}-${index + 1}`,
              step: level.session - 1,
              minStalls: sessionMinStalls(track, level.difficulty),
            });
      puzzles.push(withLessonIds(source, level.id, track, index));
    }
    variants[track] = { xpReward: variantXp(level.xpReward, track), puzzles };
  }
  const metadata = Object.fromEntries(
    Object.entries(level).filter(([key]) => !PUZZLE_FIELDS.includes(key)),
  );
  return { ...metadata, variants };
}

const authored = {
  ...catalog,
  version: 4,
  levels: catalog.levels.map((level) => {
    const next = authorLevel(level);
    console.log(`level ${level.id} ok`);
    return next;
  }),
};

const errors = validateCatalog(authored);
if (errors.length) {
  console.error(`Catálogo inválido:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
writeFileSync(catalogPath, `${JSON.stringify(authored, null, 2)}\n`);
console.log(`Catálogo versão 4 gravado em ${catalogPath}.`);
