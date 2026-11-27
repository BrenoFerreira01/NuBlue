import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { request } from "tests/orchestrator.js";

export const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);
export const levelById = new Map(
  catalog.levels.map((level) => [level.id, level]),
);

/** Cruzadinha `index` (0–3) da versão `difficulty` de um nível. */
export const puzzleOf = (levelId, difficulty = "medium", index = 0) =>
  levelById.get(levelId).variants[difficulty].puzzles[index];

export const answersOf = (levelId, difficulty = "medium", index = 0) =>
  puzzleOf(levelId, difficulty, index).answerKey;

export const wrongAnswersOf = (levelId, difficulty = "medium", index = 0) =>
  Object.fromEntries(
    puzzleOf(levelId, difficulty, index).inputIds.map((id) => [id, 0]),
  );

let keyCounter = 0;
export const newKey = () => `test-key-${process.pid}-${++keyCounter}`;

/** Envia uma tentativa de uma cruzadinha da lição. */
export function attempt(
  cookie,
  levelId,
  {
    difficulty = "medium",
    puzzleIndex = 0,
    lessonId = randomUUID(),
    answers = answersOf(levelId, difficulty, puzzleIndex),
    idempotencyKey = newKey(),
  } = {},
) {
  return request("/api/v1/attempts", {
    method: "POST",
    cookie,
    body: {
      levelId,
      difficulty,
      puzzleIndex,
      lessonId,
      answers,
      idempotencyKey,
    },
  });
}

/** Acerta as 4 cruzadinhas de uma lição; devolve a última resposta. */
export async function completeLesson(cookie, levelId, difficulty = "medium") {
  const lessonId = randomUUID();
  let last;
  for (let puzzleIndex = 0; puzzleIndex < 4; puzzleIndex += 1)
    last = await attempt(cookie, levelId, {
      difficulty,
      puzzleIndex,
      lessonId,
    });
  return last;
}
