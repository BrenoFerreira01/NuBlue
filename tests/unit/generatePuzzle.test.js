import { LEVELS } from "lib/game/levels.js";
import {
  generateDailyPuzzle,
  generatePuzzle,
} from "lib/game/generatePuzzle.js";
import { createSeededRandom } from "lib/game/dailyChallenge";
import { validateCatalog } from "infra/catalog-validation.mjs";

// Puzzles locais e gerados são validados no modo não estrito: topologia,
// contas e banco, sem exigir solução única nem dedução em cadeia.
function topologyErrors(puzzle) {
  const catalog = {
    version: 1,
    chapters: [{ id: 1, title: "Local" }],
    levels: [
      {
        id: 1,
        chapter: 1,
        session: 1,
        isBonus: false,
        title: puzzle.title,
        subtitle: puzzle.subtitle,
        emoji: puzzle.emoji,
        difficulty: puzzle.difficulty,
        xpReward: puzzle.xpReward,
        grid: puzzle.grid,
        bank: puzzle.bank,
        inputIds: Object.keys(puzzle.answers),
        answerKey: puzzle.answers,
      },
    ],
    bonus: null,
  };
  return validateCatalog(catalog, { strict: false });
}

describe("puzzles locais formam cruzadinhas conectadas", () => {
  it("níveis locais", () => {
    for (const level of LEVELS) expect(topologyErrors(level)).toEqual([]);
  });

  it("desafios diários de um mês", () => {
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      expect(topologyErrors(generateDailyPuzzle(date))).toEqual([]);
    }
  });

  it("rodadas geradas de 1 a 12", () => {
    for (let round = 1; round <= 12; round += 1) {
      const random = createSeededRandom(`rodada-${round}`);
      expect(topologyErrors(generatePuzzle(round, random))).toEqual([]);
    }
  });
});

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
