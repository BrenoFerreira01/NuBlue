import { readDailyRun } from "lib/game/localDailyRun";

export const LANDING_DAILY_STORAGE_KEY = "nublue-landing-daily-challenge";

/** Situação do desafio da landing page no dia ("in_progress", "completed", "failed") ou null. */
export function readLandingDailyStatus(date) {
  return readDailyRun(LANDING_DAILY_STORAGE_KEY, date)?.run.status ?? null;
}
