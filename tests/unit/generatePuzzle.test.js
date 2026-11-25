import { LEVELS } from "lib/game/levels.js";
import { generateDailyPuzzle } from "lib/game/generatePuzzle.js";

function assertConsistent(level) {
  const inputIds = level.inputIds ?? Object.keys(level.answers ?? {});
  const answers = level.answerKey ?? level.answers;
  expect(new Set(inputIds).size).toBe(inputIds.length);
  for (const id of inputIds) {
    expect(level.bank).toContain(answers[id]);
  }
}

describe("puzzles locais (modo visitante)", () => {
  it("todo nível local tem respostas presentes no banco de números", () => {
    for (const level of LEVELS) assertConsistent(level);
  });

  it("o desafio diário gerado é consistente e igual para a mesma data", () => {
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      const puzzle = generateDailyPuzzle(date);
      assertConsistent(puzzle);
      expect(generateDailyPuzzle(date)).toEqual(puzzle);
    }
  });
});
