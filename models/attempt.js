import { PUZZLES_PER_LESSON } from "infra/catalog-validation.mjs";
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
import { isDifficulty } from "models/user.js";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Qual cruzadinha da lição o aluno respondeu. */
function parseLessonTarget({ difficulty, puzzleIndex, lessonId }) {
  if (!isDifficulty(difficulty)) {
    throw new ValidationError("invalid_difficulty");
  }
  if (
    !Number.isInteger(puzzleIndex) ||
    puzzleIndex < 0 ||
    puzzleIndex >= PUZZLES_PER_LESSON
  ) {
    throw new ValidationError("invalid_puzzle_index");
  }
  if (typeof lessonId !== "string" || !UUID.test(lessonId)) {
    throw new ValidationError("invalid_lesson_id");
  }
  return { difficulty, puzzleIndex, lessonId };
}

/** As 4 cruzadinhas da lição já têm uma tentativa certa? */
async function lessonIsComplete(client, studentId, levelId, lessonId) {
  const { rows } = await client.query(
    `SELECT count(DISTINCT puzzle_index)::integer AS solved
     FROM level_attempts
     WHERE student_id = $1 AND level_id = $2 AND lesson_id = $3 AND is_correct`,
    [studentId, levelId, lessonId],
  );
  return rows[0].solved === PUZZLES_PER_LESSON;
}

/** Tentativa já registrada com esta chave (ou null). */
async function findReplay(client, studentId, levelId, idempotencyKey, answers) {
  const { rows } = await client.query(
    `SELECT level_id, submitted_answers, is_correct, xp_awarded,
            difficulty, puzzle_index, lesson_id
     FROM level_attempts WHERE student_id = $1 AND idempotency_key = $2`,
    [studentId, idempotencyKey],
  );
  if (!rows.length) return null;
  const [attempt] = rows;
  if (attempt.level_id !== levelId) {
    throw new ConflictError("idempotency_key_reused");
  }
  assertSameAnswers(attempt.submitted_answers, answers);
  return attempt;
}

/** Devolve o resultado já gravado; errar inclui a resposta certa. */
function replayResult(level, attempt, lessonCompleted) {
  const result = { correct: attempt.is_correct };
  if (!attempt.is_correct) {
    result.correctAnswers =
      level.answer_key[attempt.difficulty][attempt.puzzle_index];
  }
  return {
    ...result,
    lessonCompleted,
    xpAwarded: attempt.xp_awarded,
    replayed: true,
  };
}

/**
 * Corrige uma cruzadinha da lição no servidor. Errar devolve a resposta certa;
 * o nível é concluído (e o XP da versão é dado, só na primeira vez) quando as
 * 4 cruzadinhas da mesma lição estão certas. Repetir a mesma chave de
 * idempotência devolve o resultado já gravado.
 */
async function submitCourseAttempt(
  student,
  { levelId, answers, idempotencyKey, ...target },
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
    const { difficulty, puzzleIndex, lessonId } = parseLessonTarget(target);
    await assertLevelUnlocked(client, student.id, level);

    const replay = await findReplay(
      client,
      student.id,
      levelId,
      idempotencyKey,
      answers,
    );
    if (replay) {
      const lessonCompleted = await lessonIsComplete(
        client,
        student.id,
        levelId,
        replay.lesson_id,
      );
      return replayResult(level, replay, lessonCompleted);
    }

    const answerKey = level.answer_key[difficulty][puzzleIndex];
    const correct = answersMatch(answers, answerKey);
    const created = await client.query(
      `INSERT INTO level_attempts
        (student_id, level_id, idempotency_key, submitted_answers, is_correct,
         difficulty, puzzle_index, lesson_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       ON CONFLICT (student_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        student.id,
        levelId,
        idempotencyKey,
        JSON.stringify(answers),
        correct,
        difficulty,
        puzzleIndex,
        lessonId,
      ],
    );
    if (!created.rowCount) {
      // Outra requisição com a mesma chave gravou primeiro.
      const raced = await findReplay(
        client,
        student.id,
        levelId,
        idempotencyKey,
        answers,
      );
      return replayResult(level, raced, false);
    }
    if (!correct) {
      return {
        correct: false,
        correctAnswers: answerKey,
        lessonCompleted: false,
        xpAwarded: 0,
        replayed: false,
      };
    }

    const lessonCompleted = await lessonIsComplete(
      client,
      student.id,
      levelId,
      lessonId,
    );
    let xpAwarded = 0;
    if (lessonCompleted) {
      const completion = await client.query(
        `INSERT INTO level_completions (student_id, level_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING level_id`,
        [student.id, levelId],
      );
      if (completion.rowCount) {
        xpAwarded = level.public_data.variants[difficulty].xpReward;
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
    }
    return { correct: true, lessonCompleted, xpAwarded, replayed: false };
  });

  return { ...result, progress: await progress.get(student.id) };
}

const attempt = { submitCourseAttempt };

export default attempt;
