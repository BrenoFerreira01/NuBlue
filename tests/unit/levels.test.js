import { LEVELS } from "lib/game/levels.js";
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
});
