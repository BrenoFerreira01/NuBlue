import database from "infra/database.js";
import { ValidationError } from "infra/errors.js";

// Expressões fixas (nunca vindas do cliente) para cada período.
const SCORE_BY_PERIOD = {
  weekly:
    "COALESCE(SUM(e.amount) FILTER (WHERE e.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0)",
  all: "COALESCE(SUM(e.amount), 0)",
};

/**
 * Posição de quem está vendo: { optedIn, xp, rank }. rank segue a ordem da
 * lista (XP, depois apelido) entre quem aparece no ranking com XP; null para
 * quem não aceitou aparecer.
 */
async function viewerPosition(score, viewerId) {
  const { rows } = await database.query(
    `WITH scores AS (
       SELECT s.id, s.nickname_key, s.leaderboard_opt_in, ${score}::integer AS xp
       FROM students s
       LEFT JOIN xp_events e ON e.student_id = s.id
       WHERE s.deleted_at IS NULL
       GROUP BY s.id
     ), me AS (SELECT * FROM scores WHERE id = $1)
     SELECT me.xp, me.leaderboard_opt_in AS opted_in,
            1 + (SELECT count(*) FROM scores o
                 WHERE o.leaderboard_opt_in AND o.xp > 0 AND o.id <> me.id
                   AND (o.xp > me.xp
                        OR (o.xp = me.xp AND o.nickname_key < me.nickname_key))
                )::integer AS rank
     FROM me`,
    [viewerId],
  );
  const [row] = rows;
  if (!row) return undefined;
  return {
    optedIn: row.opted_in,
    xp: row.xp,
    rank: row.opted_in ? row.rank : null,
  };
}

/** Top 50 de quem aceitou aparecer no ranking e tem XP no período. */
async function list(period = "weekly", viewerId = null) {
  const score = SCORE_BY_PERIOD[period];
  if (!score) throw new ValidationError("invalid_period");
  const { rows } = await database.query(
    `SELECT s.nickname, ${score}::integer AS xp,
            CASE
              WHEN p.last_active_on >= (now() AT TIME ZONE 'UTC')::date - 1
              THEN COALESCE(p.streak_days, 0)
              ELSE 0
            END::integer AS streak
     FROM students s
     LEFT JOIN xp_events e ON e.student_id = s.id
     LEFT JOIN student_progress p ON p.student_id = s.id
     WHERE s.leaderboard_opt_in = true AND s.deleted_at IS NULL
     GROUP BY s.id, s.nickname, s.nickname_key, p.streak_days, p.last_active_on
     HAVING ${score} > 0
     ORDER BY xp DESC, s.nickname_key ASC
     LIMIT 50`,
  );
  if (!viewerId) return { period, entries: rows };
  return { period, entries: rows, me: await viewerPosition(score, viewerId) };
}

const leaderboard = { list };

export default leaderboard;
