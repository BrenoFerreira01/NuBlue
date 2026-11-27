// Rodada do desafio diário guardada no navegador (visitantes e landing page).
import { DAILY_HEARTS } from "lib/game/dailyRun.mjs";

const STATUSES = new Set(["in_progress", "completed", "failed"]);
const isCount = (value) => Number.isInteger(value) && value >= 0;

/** { run, fills } do dia, ou null se não houver rodada válida dessa data. */
export function readDailyRun(storageKey, dateKey) {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey));
    if (
      !value ||
      value.date !== dateKey ||
      !STATUSES.has(value.status) ||
      ![value.startStep, value.currentIndex, value.score].every(isCount)
    )
      return null;
    const fills =
      value.fills && typeof value.fills === "object"
        ? Object.fromEntries(
            Object.entries(value.fills).filter(
              ([, fill]) => fill === null || Number.isInteger(fill),
            ),
          )
        : {};
    return {
      run: {
        date: dateKey,
        startStep: value.startStep,
        currentIndex: value.currentIndex,
        score: value.score,
        hearts: Number.isInteger(value.hearts)
          ? Math.min(DAILY_HEARTS, Math.max(0, value.hearts))
          : DAILY_HEARTS,
        status: value.status,
      },
      fills,
    };
  } catch {
    return null;
  }
}

export function saveDailyRun(storageKey, run, fills = {}) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ ...run, fills }));
  } catch {
    // A rodada continua nesta visita quando o armazenamento está indisponível.
  }
}
