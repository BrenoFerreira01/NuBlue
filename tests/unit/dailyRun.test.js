import {
  applyDailyAnswer,
  canPlay,
  createDailyRun,
  dailyPuzzle,
  dailyXp,
} from "lib/game/dailyRun.mjs";
import { DAILY_START_STEP } from "lib/game/tracks.mjs";

const DATE = "2026-11-27";

describe("desafio diário infinito", () => {
  it("a mesma data, degrau inicial, posição e acertos geram a mesma cruzadinha", () => {
    expect(dailyPuzzle(DATE, 3, 5, 2)).toEqual(dailyPuzzle(DATE, 3, 5, 2));
    expect(dailyPuzzle(DATE, 3, 5, 2).puzzle).not.toEqual(
      dailyPuzzle(DATE, 3, 6, 2).puzzle,
    );
  });

  it("começa no degrau da dificuldade geral e sobe a cada 3 acertos", () => {
    expect(dailyPuzzle(DATE, DAILY_START_STEP.easy, 0, 0).step).toBe(0);
    expect(dailyPuzzle(DATE, DAILY_START_STEP.medium, 0, 0).step).toBe(3);
    expect(dailyPuzzle(DATE, 3, 9, 3).step).toBe(4);
    expect(dailyPuzzle(DATE, 3, 9, 6).step).toBe(5);
    expect(dailyPuzzle(DATE, 6, 40, 30).step).toBe(8);
  });

  it("os primeiros degraus usam só soma e subtração", () => {
    for (let k = 0; k < 6; k += 1) {
      const { puzzle } = dailyPuzzle(DATE, 0, k, 0);
      const operators = puzzle.grid
        .flat()
        .filter((cell) => cell?.type === "operator")
        .map((cell) => cell.value);
      for (const op of operators) expect(["+", "−"]).toContain(op);
    }
  });

  it("cada acerto vale 5 + degrau de XP", () => {
    expect(dailyXp(0)).toBe(5);
    expect(dailyXp(8)).toBe(13);
  });

  it("acertar soma ponto; errar gasta vida; o 3º erro encerra o dia", () => {
    let run = createDailyRun(DATE, 3);
    expect(run).toMatchObject({
      date: DATE,
      startStep: 3,
      currentIndex: 0,
      score: 0,
      hearts: 3,
      status: "in_progress",
    });
    run = applyDailyAnswer(run, true);
    expect(run).toMatchObject({ currentIndex: 1, score: 1, hearts: 3 });
    run = applyDailyAnswer(applyDailyAnswer(run, false), false);
    expect(run).toMatchObject({ currentIndex: 3, hearts: 1 });
    expect(run.status).toBe("in_progress");
    run = applyDailyAnswer(run, false);
    expect(run).toMatchObject({ hearts: 0, status: "completed" });
  });

  it("sem nenhum acerto, o dia termina como falha", () => {
    let run = createDailyRun(DATE, 0);
    for (let i = 0; i < 3; i += 1) run = applyDailyAnswer(run, false);
    expect(run.status).toBe("failed");
  });

  it("depois das 3 vidas, só no dia seguinte", () => {
    let run = createDailyRun(DATE, 0);
    for (let i = 0; i < 3; i += 1) run = applyDailyAnswer(run, false);
    expect(canPlay(run, DATE)).toBe(false);
    expect(canPlay(run, "2026-11-28")).toBe(true);
    expect(canPlay(createDailyRun(DATE, 0), DATE)).toBe(true);
    expect(canPlay(null, DATE)).toBe(true);
  });
});
