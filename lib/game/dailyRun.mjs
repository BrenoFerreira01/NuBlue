// Desafio diário infinito: cruzadinhas geradas a partir da data, ficando mais
// difíceis aos poucos, com 3 vidas próprias. Vale para o app, a landing page
// e o servidor, que gera de novo a cruzadinha para conferir a resposta.
import { generateTrackPuzzle } from "./trackPuzzle.mjs";
import { dailyStep, trackForStep } from "./tracks.mjs";

export const DAILY_HEARTS = 3;
const ALL_OPERATIONS = ["+", "−", "×", "÷"];
const EARLY_OPERATIONS = ["+", "−"];

/** A cruzadinha `k` do dia: { step, puzzle: { grid, inputIds, bank, answers } }. */
export function dailyPuzzle(dateKey, startStep, k, solved) {
  const step = dailyStep(startStep, solved);
  const puzzle = generateTrackPuzzle({
    operations: step <= 1 ? EARLY_OPERATIONS : ALL_OPERATIONS,
    track: trackForStep(step),
    seed: `${dateKey}-${startStep}-${k}`,
    step: step % 3,
  });
  return { step, puzzle };
}

export const dailyXp = (step) => 5 + step;

export function createDailyRun(dateKey, startStep) {
  return {
    date: dateKey,
    startStep,
    currentIndex: 0,
    score: 0,
    hearts: DAILY_HEARTS,
    status: "in_progress",
  };
}

/** Acerto soma ponto; erro gasta vida. Sem vidas, o dia termina. */
export function applyDailyAnswer(run, correct) {
  const score = run.score + (correct ? 1 : 0);
  const hearts = run.hearts - (correct ? 0 : 1);
  let status = "in_progress";
  if (hearts <= 0) status = score > 0 ? "completed" : "failed";
  return { ...run, currentIndex: run.currentIndex + 1, score, hearts, status };
}

/** Só dá para jogar de novo no mesmo dia enquanto houver vidas. */
export function canPlay(run, todayKey) {
  return !run || run.date !== todayKey || run.status === "in_progress";
}
