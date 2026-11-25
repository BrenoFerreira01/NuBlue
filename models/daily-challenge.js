import database from "infra/database.js";
import { ConflictError, ServiceError, ValidationError } from "infra/errors.js";
import { answersMatch, assertSameAnswers } from "models/answers.js";
import { catalog } from "models/catalog.js";
import progress, { utcDateKey } from "models/progress.js";

function finished() {
  return new ConflictError("daily_challenge_finished");
}

/** O nível do dia é o mesmo para todos: escolhido pela data (UTC). */
function challengeIndex(dateKey) {
  const day = Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000);
  return day % catalog.levels.length;
}

/** Garante a rodada do aluno no dia e devolve { level, run }. */
async function ensureRun(studentId, dateKey) {
  const selected = await database.query(
    `SELECT id, public_data FROM course_levels
     WHERE is_bonus = false ORDER BY id OFFSET $1 LIMIT 1`,
    [challengeIndex(dateKey)],
  );
  const level = selected.rows[0];
  if (!level) throw new ServiceError("course_unavailable");
  await database.query(
    `INSERT INTO daily_challenge_runs (student_id, challenge_date, level_id, status)
     VALUES ($1, $2::date, $3, 'in_progress') ON CONFLICT (student_id, challenge_date) DO NOTHING`,
    [studentId, dateKey, level.id],
  );
  const run = await database.query(
    `SELECT challenge_date::text, level_id, status, hearts, attempt_count, submitted_answers
     FROM daily_challenge_runs WHERE student_id = $1 AND challenge_date = $2::date`,
    [studentId, dateKey],
  );
  return { level, run: run.rows[0] };
}

async function get(student) {
  const dateKey = utcDateKey();
  const { level, run } = await ensureRun(student.id, dateKey);
  return {
    date: dateKey,
    status: run.status,
    hearts: run.hearts,
    attemptCount: run.attempt_count,
    fills: run.submitted_answers,
    level: level.public_data,
  };
}

/** Salva o que o aluno já preencheu, para continuar depois. */
async function saveDraft(student, answers) {
  const dateKey = utcDateKey();
  const { level, run } = await ensureRun(student.id, dateKey);
  if (run.status !== "in_progress") throw finished();
  const validInputIds = new Set(level.public_data.inputIds);
  if (Object.keys(answers).some((id) => !validInputIds.has(id))) {
    throw new ValidationError("invalid_answers");
  }
  await database.query(
    `UPDATE daily_challenge_runs SET submitted_answers = $3::jsonb
     WHERE student_id = $1 AND challenge_date = $2::date AND status = 'in_progress'`,
    [student.id, dateKey, JSON.stringify(answers)],
  );
}

async function recordCompletion(client, studentId, dateKey) {
  await progress.recordActivity(client, studentId, dateKey);
  await client.query(
    `INSERT INTO student_progress
      (student_id, completed_daily_challenges, current_daily_streak, best_daily_streak, last_daily_challenge_on)
     VALUES ($1, 1, 1, 1, $2::date)
     ON CONFLICT (student_id) DO UPDATE SET
      completed_daily_challenges = student_progress.completed_daily_challenges + 1,
      current_daily_streak = CASE
        WHEN student_progress.last_daily_challenge_on = $2::date THEN student_progress.current_daily_streak
        WHEN student_progress.last_daily_challenge_on = $2::date - 1 THEN student_progress.current_daily_streak + 1
        ELSE 1
      END,
      best_daily_streak = GREATEST(
        student_progress.best_daily_streak,
        CASE
          WHEN student_progress.last_daily_challenge_on = $2::date THEN student_progress.current_daily_streak
          WHEN student_progress.last_daily_challenge_on = $2::date - 1 THEN student_progress.current_daily_streak + 1
          ELSE 1
        END
      ),
      last_daily_challenge_on = $2::date,
      updated_at = now()`,
    [studentId, dateKey],
  );
}

/**
 * Corrige a tentativa do dia. Acertar conclui e dá XP; errar custa um coração,
 * e sem corações o desafio falha e a sequência diária zera.
 */
async function submit(student, { answers, idempotencyKey }) {
  const dateKey = utcDateKey();
  await ensureRun(student.id, dateKey);

  const result = await database.transaction(async (client) => {
    const {
      rows: [run],
    } = await client.query(
      `SELECT level_id, status, hearts FROM daily_challenge_runs
       WHERE student_id = $1 AND challenge_date = $2::date FOR UPDATE`,
      [student.id, dateKey],
    );
    const duplicate = await client.query(
      `SELECT is_correct, xp_awarded, submitted_answers FROM daily_challenge_attempts
       WHERE student_id = $1 AND challenge_date = $2::date AND idempotency_key = $3`,
      [student.id, dateKey, idempotencyKey],
    );
    if (duplicate.rowCount) {
      const [previous] = duplicate.rows;
      assertSameAnswers(previous.submitted_answers, answers);
      return {
        correct: previous.is_correct,
        xpAwarded: previous.xp_awarded,
        status: run.status,
        hearts: run.hearts,
        replayed: true,
      };
    }
    if (run.status !== "in_progress") throw finished();

    const {
      rows: [level],
    } = await client.query(
      "SELECT public_data, answer_key FROM course_levels WHERE id = $1",
      [run.level_id],
    );
    const correct = answersMatch(answers, level.answer_key);
    const xpAwarded = correct ? level.public_data.xpReward : 0;
    await client.query(
      `INSERT INTO daily_challenge_attempts
        (student_id, challenge_date, idempotency_key, submitted_answers, is_correct, xp_awarded)
       VALUES ($1, $2::date, $3, $4::jsonb, $5, $6)`,
      [
        student.id,
        dateKey,
        idempotencyKey,
        JSON.stringify(answers),
        correct,
        xpAwarded,
      ],
    );

    if (correct) {
      await client.query(
        `UPDATE daily_challenge_runs
         SET status = 'completed', completed_at = now(), attempt_count = attempt_count + 1
         WHERE student_id = $1 AND challenge_date = $2::date`,
        [student.id, dateKey],
      );
      await client.query(
        `INSERT INTO xp_events (student_id, source, source_id, amount)
         VALUES ($1, 'daily_challenge', $2, $3) ON CONFLICT DO NOTHING`,
        [student.id, dateKey, xpAwarded],
      );
      await recordCompletion(client, student.id, dateKey);
      return {
        correct: true,
        xpAwarded,
        status: "completed",
        hearts: run.hearts,
        replayed: false,
      };
    }

    const hearts = Math.max(0, run.hearts - 1);
    const status = hearts === 0 ? "failed" : "in_progress";
    await client.query(
      `UPDATE daily_challenge_runs
       SET status = $3, hearts = $4, attempt_count = attempt_count + 1,
           submitted_answers = $5::jsonb
       WHERE student_id = $1 AND challenge_date = $2::date`,
      [student.id, dateKey, status, hearts, JSON.stringify(answers)],
    );
    if (status === "failed") {
      await client.query(
        `INSERT INTO student_progress (student_id, current_daily_streak, last_daily_challenge_on)
         VALUES ($1, 0, $2::date)
         ON CONFLICT (student_id) DO UPDATE SET
          current_daily_streak = 0, last_daily_challenge_on = $2::date, updated_at = now()`,
        [student.id, dateKey],
      );
    }
    return { correct: false, xpAwarded: 0, status, hearts, replayed: false };
  });

  return { ...result, progress: await progress.get(student.id) };
}

const dailyChallenge = { get, saveDraft, submit };

export default dailyChallenge;
