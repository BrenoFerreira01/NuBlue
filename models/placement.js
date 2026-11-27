import database from "infra/database.js";
import { ConflictError, ValidationError } from "infra/errors.js";
import { catalog } from "models/catalog.js";
import progress from "models/progress.js";
import { isDifficulty } from "models/user.js";

const chapterIds = new Set(catalog.chapters.map((chapter) => chapter.id));

export function parsePlacement(body) {
  const chapter = body?.chapter;
  const difficulty = body?.difficulty;
  if (!chapterIds.has(chapter) || !isDifficulty(difficulty)) {
    throw new ValidationError("invalid_placement");
  }
  return { chapter, difficulty };
}

function alreadyDone() {
  return new ConflictError(
    "placement_already_done",
    "O nivelamento já foi feito nesta conta.",
  );
}

/**
 * Aplica o resultado do teste de nivelamento, uma única vez: grava a
 * dificuldade e marca como concluídos, sem XP, os níveis dos capítulos
 * anteriores ao indicado.
 */
async function apply(student, { chapter, difficulty }) {
  await database.transaction(async (client) => {
    const {
      rows: [row],
    } = await client.query(
      `SELECT placement_completed_at,
              EXISTS (SELECT 1 FROM level_completions WHERE student_id = $1) AS has_completions
       FROM students WHERE id = $1 FOR UPDATE`,
      [student.id],
    );
    if (row.placement_completed_at || row.has_completions) throw alreadyDone();

    await client.query(
      `INSERT INTO level_completions (student_id, level_id)
       SELECT $1, id FROM course_levels
       WHERE is_bonus = false AND chapter < $2
       ON CONFLICT DO NOTHING`,
      [student.id, chapter],
    );
    await client.query(
      `UPDATE students SET difficulty = $2, placement_completed_at = now()
       WHERE id = $1`,
      [student.id, difficulty],
    );
  });
  return { progress: await progress.get(student.id) };
}

const placement = { apply };

export default placement;
