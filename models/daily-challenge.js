import database from "infra/database.js";
import { ConflictError, ValidationError } from "infra/errors.js";
import { answersMatch, assertSameAnswers } from "models/answers.js";
import progress, { utcDateKey } from "models/progress.js";
import { randomUUID } from "node:crypto";
import {
  MODE_HEARTS,
  applyDailyAnswer,
  dailyPuzzle,
  dailyXp,
} from "lib/game/dailyRun.mjs";
import { DAILY_START_STEP, trackForStep } from "lib/game/tracks.mjs";

function finished() {
  return new ConflictError("daily_challenge_finished");
}

/**
 * Garante a rodada do aluno no dia. O degrau inicial vem da dificuldade geral
 * no momento em que o dia começa.
 */
async function ensureRun(client, student, dateKey) {
  await client.query(
    `INSERT INTO daily_challenge_runs
       (student_id, challenge_date, status, start_step, seed, hearts)
     VALUES ($1, $2::date, 'in_progress', $3, $4, $5)
     ON CONFLICT (student_id, challenge_date) DO NOTHING`,
    [
      student.id,
      dateKey,
      DAILY_START_STEP[student.difficulty] ?? 3,
      randomUUID(),
      MODE_HEARTS,
    ],
  );
  const { rows } = await client.query(
    `SELECT status, hearts, attempt_count, submitted_answers,
            current_index, score, start_step, seed
     FROM daily_challenge_runs WHERE student_id = $1 AND challenge_date = $2::date`,
    [student.id, dateKey],
  );
  return rows[0];
}

// A semente sorteia as cruzadinhas da rodada e nunca vai para o cliente
// (rodadas antigas, sem semente, usam a data).
const seedOf = (row, dateKey) => row.seed ?? dateKey;

const toRun = (row, dateKey) => ({
  date: dateKey,
  startStep: row.start_step,
  currentIndex: row.current_index,
  score: row.score,
  hearts: row.hearts,
  status: row.status,
});

/** A cruzadinha atual, sem respostas, no formato de um nível. */
function publicLevel(run, { step, puzzle }) {
  return {
    id: -(Number(run.date.replaceAll("-", "")) * 1000 + run.currentIndex),
    chapter: 0,
    session: 1,
    title: "Modo Desafio",
    subtitle: `Cruzadinha ${run.currentIndex + 1}`,
    emoji: "🔥",
    difficulty: trackForStep(step),
    xpReward: dailyXp(step),
    grid: puzzle.grid,
    inputIds: puzzle.inputIds,
    bank: puzzle.bank,
  };
}

const currentPuzzle = (run, seed) =>
  dailyPuzzle(seed, run.startStep, run.currentIndex, run.score);

/** As vidas do Modo Desafio voltam na virada do dia (meia-noite UTC). */
function nextUtcMidnight(dateKey) {
  const reset = new Date(`${dateKey}T00:00:00.000Z`);
  reset.setUTCDate(reset.getUTCDate() + 1);
  return reset.toISOString();
}

async function get(student) {
  const dateKey = utcDateKey();
  const row = await ensureRun(database, student, dateKey);
  const run = toRun(row, dateKey);
  const current = currentPuzzle(run, seedOf(row, dateKey));
  return {
    ...run,
    resetsAt: nextUtcMidnight(dateKey),
    step: current.step,
    attemptCount: row.attempt_count,
    fills: row.submitted_answers,
    level: publicLevel(run, current),
  };
}

/** Salva o que o aluno já preencheu na cruzadinha atual, para continuar depois. */
async function saveDraft(student, answers) {
  const dateKey = utcDateKey();
  const row = await ensureRun(database, student, dateKey);
  if (row.status !== "in_progress") throw finished();
  const validInputIds = new Set(
    currentPuzzle(toRun(row, dateKey), seedOf(row, dateKey)).puzzle.inputIds,
  );
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

async function resetDailyStreak(client, studentId, dateKey) {
  await client.query(
    `INSERT INTO student_progress (student_id, current_daily_streak, last_daily_challenge_on)
     VALUES ($1, 0, $2::date)
     ON CONFLICT (student_id) DO UPDATE SET
      current_daily_streak = 0, last_daily_challenge_on = $2::date, updated_at = now()`,
    [studentId, dateKey],
  );
}

/**
 * Corrige a cruzadinha atual do dia. Acertar soma ponto e XP; errar gasta uma
 * vida e devolve a resposta certa. Nos dois casos a rodada passa para a
 * próxima cruzadinha; sem vidas, o desafio do dia termina.
 */
async function submit(student, { answers, idempotencyKey }) {
  const dateKey = utcDateKey();

  const result = await database.transaction(async (client) => {
    await ensureRun(client, student, dateKey);
    const {
      rows: [row],
    } = await client.query(
      `SELECT status, hearts, current_index, score, start_step, seed
       FROM daily_challenge_runs
       WHERE student_id = $1 AND challenge_date = $2::date FOR UPDATE`,
      [student.id, dateKey],
    );
    const run = toRun(row, dateKey);
    const seed = seedOf(row, dateKey);

    const duplicate = await client.query(
      `SELECT is_correct, xp_awarded, submitted_answers, puzzle_index, solved_before
       FROM daily_challenge_attempts
       WHERE student_id = $1 AND challenge_date = $2::date AND idempotency_key = $3`,
      [student.id, dateKey, idempotencyKey],
    );
    if (duplicate.rowCount) {
      const [previous] = duplicate.rows;
      assertSameAnswers(previous.submitted_answers, answers);
      const replayedPuzzle = dailyPuzzle(
        seed,
        run.startStep,
        previous.puzzle_index,
        previous.solved_before,
      ).puzzle;
      return {
        correct: previous.is_correct,
        ...(previous.is_correct
          ? {}
          : { correctAnswers: replayedPuzzle.answers }),
        xpAwarded: previous.xp_awarded,
        status: run.status,
        hearts: run.hearts,
        score: run.score,
        replayed: true,
      };
    }
    if (run.status !== "in_progress") throw finished();

    const { step, puzzle } = currentPuzzle(run, seed);
    const correct = answersMatch(answers, puzzle.answers);
    const xpAwarded = correct ? dailyXp(step) : 0;
    await client.query(
      `INSERT INTO daily_challenge_attempts
        (student_id, challenge_date, idempotency_key, submitted_answers,
         is_correct, xp_awarded, puzzle_index, solved_before)
       VALUES ($1, $2::date, $3, $4::jsonb, $5, $6, $7, $8)`,
      [
        student.id,
        dateKey,
        idempotencyKey,
        JSON.stringify(answers),
        correct,
        xpAwarded,
        run.currentIndex,
        run.score,
      ],
    );

    const next = applyDailyAnswer(run, correct);
    await client.query(
      `UPDATE daily_challenge_runs
       SET status = $3, hearts = $4, score = $5, current_index = $6,
           attempt_count = attempt_count + 1, submitted_answers = '{}'::jsonb,
           completed_at = CASE WHEN $3 = 'in_progress' THEN NULL ELSE now() END
       WHERE student_id = $1 AND challenge_date = $2::date`,
      [
        student.id,
        dateKey,
        next.status,
        next.hearts,
        next.score,
        next.currentIndex,
      ],
    );
    if (correct) {
      await client.query(
        `INSERT INTO xp_events (student_id, source, source_id, amount)
         VALUES ($1, 'daily_challenge', $2, $3) ON CONFLICT DO NOTHING`,
        [student.id, `${dateKey}:${run.currentIndex}`, xpAwarded],
      );
      // O dia conta para a sequência a partir do primeiro acerto.
      if (next.score === 1) await recordCompletion(client, student.id, dateKey);
    }
    if (next.status === "failed")
      await resetDailyStreak(client, student.id, dateKey);

    return {
      correct,
      ...(correct ? {} : { correctAnswers: puzzle.answers }),
      xpAwarded,
      status: next.status,
      hearts: next.hearts,
      score: next.score,
      replayed: false,
    };
  });

  return { ...result, progress: await progress.get(student.id) };
}

const dailyChallenge = { get, saveDraft, submit };

export default dailyChallenge;
