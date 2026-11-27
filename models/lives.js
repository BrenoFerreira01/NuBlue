import { ConflictError } from "infra/errors.js";
import { MAX_LIVES, livesAt, spendLife } from "lib/game/lives.mjs";

// Vidas das lições guardadas na conta: { lives, lives_updated_at }.

const stateOf = (row) => ({
  lives: row.lives,
  updatedAt: new Date(row.lives_updated_at).getTime(),
});

/** Formato da API: { lives, max, nextLifeAt } (ISO ou null). */
export function publicLives(state, now = Date.now()) {
  const current = livesAt(state, now);
  return {
    lives: current.lives,
    max: MAX_LIVES,
    nextLifeAt: current.nextLifeAt
      ? new Date(current.nextLifeAt).toISOString()
      : null,
  };
}

async function read(client, studentId, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT lives, lives_updated_at FROM students WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [studentId],
  );
  return stateOf(rows[0]);
}

async function get(client, studentId) {
  return publicLives(await read(client, studentId));
}

/** Trava a linha do aluno e recusa a tentativa se não houver vidas. */
async function requireLife(client, studentId) {
  const state = await read(client, studentId, { forUpdate: true });
  if (livesAt(state, Date.now()).lives <= 0) {
    throw new ConflictError(
      "no_lives",
      "Suas vidas acabaram. Uma nova vida volta em até 15 minutos.",
    );
  }
  return state;
}

/** Gasta uma vida (na mesma transação de requireLife). */
async function spend(client, studentId, state) {
  const now = Date.now();
  const next = spendLife(state, now);
  await client.query(
    "UPDATE students SET lives = $2, lives_updated_at = $3 WHERE id = $1",
    [studentId, next.lives, new Date(next.updatedAt)],
  );
  return publicLives(next, now);
}

const lives = { get, requireLife, spend };

export default lives;
