import database from "infra/database.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "infra/errors.js";
import { answersMatch, assertSameAnswers } from "models/answers.js";
import courseCatalog, { catalog } from "models/catalog.js";
import progress, { utcDateKey } from "models/progress.js";

export function parseLevelId(value) {
  const levelId = Number(value);
  if (!Number.isInteger(levelId) || levelId < 1) {
    throw new ValidationError("invalid_level_id");
  }
  return levelId;
}

function levelLocked() {
  return new ForbiddenError(
    "level_locked",
    "Complete o nível anterior para continuar.",
  );
}

async function assertLevelUnlocked(client, studentId, level) {
  if (level.is_bonus) {
    const completed = await courseCatalog.countCompletedCourseLevels(
      client,
      studentId,
    );
    if (completed < catalog.levels.length) throw levelLocked();
    return;
  }
  const previous = await client.query(
    `SELECT id FROM course_levels
     WHERE chapter = $1 AND is_bonus = false AND id < $2
     ORDER BY id DESC LIMIT 1`,
    [level.public_data.chapter, level.id],
  );
  if (!previous.rowCount) return;
  const completed = await client.query(
    "SELECT 1 FROM level_completions WHERE student_id = $1 AND level_id = $2",
    [studentId, previous.rows[0].id],
  );
  if (!completed.rowCount) throw levelLocked();
}

/** Tentativa já registrada com esta chave: devolve o mesmo resultado. */
async function findReplay(client, studentId, levelId, idempotencyKey, answers) {
  const { rows } = await client.query(
    `SELECT level_id, submitted_answers, is_correct, xp_awarded
     FROM level_attempts WHERE student_id = $1 AND idempotency_key = $2`,
    [studentId, idempotencyKey],
  );
  if (!rows.length) return null;
  const [attempt] = rows;
  if (attempt.level_id !== levelId) {
    throw new ConflictError("idempotency_key_reused");
  }
  assertSameAnswers(attempt.submitted_answers, answers);
  return {
    correct: attempt.is_correct,
    xpAwarded: attempt.xp_awarded,
    replayed: true,
  };
}

/**
 * Corrige a tentativa no servidor. O XP vem só na primeira conclusão do nível;
 * repetir a mesma chave de idempotência devolve o resultado já gravado.
 */
async function submitCourseAttempt(
  student,
  { levelId, answers, idempotencyKey },
) {
  const result = await database.transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id, public_data, answer_key, is_bonus FROM course_levels WHERE id = $1",
      [levelId],
    );
    const level = rows[0];
    if (!level || (level.is_bonus && !catalog.bonus)) {
      throw new NotFoundError("level_not_found");
    }
    await assertLevelUnlocked(client, student.id, level);

    const replay = await findReplay(
      client,
      student.id,
      levelId,
      idempotencyKey,
      answers,
    );
    if (replay) return replay;

    const correct = answersMatch(answers, level.answer_key);
    const created = await client.query(
      `INSERT INTO level_attempts (student_id, level_id, idempotency_key, submitted_answers, is_correct)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (student_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [student.id, levelId, idempotencyKey, JSON.stringify(answers), correct],
    );
    if (!created.rowCount) {
      // Outra requisição com a mesma chave gravou primeiro.
      return findReplay(client, student.id, levelId, idempotencyKey, answers);
    }
    if (!correct) return { correct: false, xpAwarded: 0, replayed: false };

    const completion = await client.query(
      `INSERT INTO level_completions (student_id, level_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING level_id`,
      [student.id, levelId],
    );
    let xpAwarded = 0;
    if (completion.rowCount) {
      xpAwarded = level.public_data.xpReward;
      await client.query(
        "INSERT INTO xp_events (student_id, source, source_id, amount) VALUES ($1, 'level', $2, $3)",
        [student.id, String(levelId), xpAwarded],
      );
      await client.query(
        "UPDATE level_attempts SET xp_awarded = $1 WHERE id = $2",
        [xpAwarded, created.rows[0].id],
      );
      await progress.recordActivity(client, student.id, utcDateKey());
    }
    return { correct: true, xpAwarded, replayed: false };
  });

  return { ...result, progress: await progress.get(student.id) };
}

const attempt = { submitCourseAttempt };

export default attempt;
