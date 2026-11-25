import database from "infra/database.js";
import { NotFoundError } from "infra/errors.js";
import courseCatalog, { catalog } from "models/catalog.js";

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Progresso do aluno; sequências zeram se ele ficou mais de um dia sem jogar. */
async function get(studentId, dateKey = utcDateKey()) {
  const {
    rows: [row],
  } = await database.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM xp_events WHERE student_id = $1), 0)::integer AS total_xp,
       COALESCE(p.total_solved, 0)::integer AS total_solved,
       CASE WHEN p.last_active_on >= $2::date - 1 THEN COALESCE(p.streak_days, 0) ELSE 0 END::integer AS streak,
       COALESCE(p.completed_daily_challenges, 0)::integer AS daily_challenges_completed,
       CASE WHEN p.last_daily_challenge_on >= $2::date - 1 THEN COALESCE(p.current_daily_streak, 0) ELSE 0 END::integer AS current_daily_streak,
       COALESCE(p.best_daily_streak, 0)::integer AS best_daily_streak,
       COALESCE((SELECT array_agg(level_id ORDER BY level_id) FROM level_completions WHERE student_id = $1), ARRAY[]::integer[]) AS completed_levels
     FROM students s
     LEFT JOIN student_progress p ON p.student_id = s.id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [studentId, dateKey],
  );
  if (!row) throw new NotFoundError("student_not_found");
  return {
    totalXp: row.total_xp,
    totalSolved: row.total_solved,
    streak: row.streak,
    dailyChallengesCompleted: row.daily_challenges_completed,
    currentDailyStreak: row.current_daily_streak,
    bestDailyStreak: row.best_daily_streak,
    completedLevels: row.completed_levels,
  };
}

/**
 * Situação de cada nível do curso: dentro de um capítulo, um nível fica
 * disponível quando o anterior foi concluído.
 */
async function availability(studentId) {
  const { rows } = await database.query(
    `SELECT cl.id, cl.public_data->>'chapter' AS chapter,
            (lc.level_id IS NOT NULL) AS completed
     FROM course_levels cl
     LEFT JOIN level_completions lc
       ON lc.level_id = cl.id AND lc.student_id = $1
     WHERE cl.is_bonus = false
     ORDER BY cl.id`,
    [studentId],
  );
  if (rows.length !== catalog.levels.length) {
    throw courseCatalog.courseNotSeeded();
  }

  const completedIds = new Set();
  const previousByChapter = new Map();
  const levels = rows.map((row) => {
    const id = Number(row.id);
    const chapter = Number(row.chapter);
    if (row.completed) completedIds.add(id);
    const previousId = previousByChapter.get(chapter);
    let status = "locked";
    if (row.completed) {
      status = "completed";
    } else if (previousId === undefined || completedIds.has(previousId)) {
      status = "available";
    }
    previousByChapter.set(chapter, id);
    return { id, status };
  });

  return {
    levels,
    bonusAvailable:
      Boolean(catalog.bonus) && completedIds.size === catalog.levels.length,
  };
}

/** Conta um exercício resolvido e atualiza a sequência de dias. */
function recordActivity(client, studentId, dateKey) {
  return client.query(
    `INSERT INTO student_progress (student_id, total_solved, streak_days, last_active_on)
     VALUES ($1, 1, 1, $2::date)
     ON CONFLICT (student_id) DO UPDATE SET
       total_solved = student_progress.total_solved + 1,
       streak_days = CASE
         WHEN student_progress.last_active_on = $2::date THEN student_progress.streak_days
         WHEN student_progress.last_active_on = $2::date - 1 THEN student_progress.streak_days + 1
         ELSE 1
       END,
       last_active_on = $2::date,
       updated_at = now()`,
    [studentId, dateKey],
  );
}

const progress = { get, availability, recordActivity };

export default progress;
