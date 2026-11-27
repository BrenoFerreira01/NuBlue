// Vidas das lições: no máximo 5, e cada vida perdida volta sozinha 15
// minutos depois, uma por vez. O estado guardado é { lives, updatedAt }: as
// vidas no instante `updatedAt` (ms); o resto é calculado a partir do relógio.

export const MAX_LIVES = 5;
export const LIFE_REGEN_MS = 15 * 60 * 1000;

export const fullLives = (now) => ({ lives: MAX_LIVES, updatedAt: now });

/** Vidas no instante `now`: { lives, updatedAt, nextLifeAt } (null se cheias). */
export function livesAt({ lives, updatedAt }, now) {
  if (lives >= MAX_LIVES)
    return { lives: MAX_LIVES, updatedAt, nextLifeAt: null };
  const regained = Math.max(0, Math.floor((now - updatedAt) / LIFE_REGEN_MS));
  if (lives + regained >= MAX_LIVES) {
    return {
      lives: MAX_LIVES,
      updatedAt: updatedAt + (MAX_LIVES - lives) * LIFE_REGEN_MS,
      nextLifeAt: null,
    };
  }
  const since = updatedAt + regained * LIFE_REGEN_MS;
  return {
    lives: lives + regained,
    updatedAt: since,
    nextLifeAt: since + LIFE_REGEN_MS,
  };
}

/** Gasta uma vida; null se não houver nenhuma. */
export function spendLife(state, now) {
  const current = livesAt(state, now);
  if (current.lives <= 0) return null;
  return {
    lives: current.lives - 1,
    // Com as vidas cheias, a contagem começa agora; senão continua a atual.
    updatedAt: current.lives === MAX_LIVES ? now : current.updatedAt,
  };
}
