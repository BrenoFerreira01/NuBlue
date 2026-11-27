import {
  DAILY_START_STEP,
  TRACKS,
  dailyStep,
  trackForStep,
} from "lib/game/tracks.mjs";
import { generateTrackPuzzle } from "lib/game/trackPuzzle.mjs";
import {
  countStalls,
  findEquations,
  validateCatalog,
} from "infra/catalog-validation.mjs";

// Envolve uma cruzadinha gerada num catálogo de um nível só.
function asCatalog(puzzle, track) {
  return {
    version: 1,
    chapters: [{ id: 1, title: "Teste" }],
    bonus: null,
    levels: [
      {
        id: 1,
        chapter: 1,
        session: 1,
        isBonus: false,
        title: "Teste",
        subtitle: "Teste",
        emoji: "➕",
        difficulty: track,
        xpReward: 10,
        grid: puzzle.grid,
        bank: puzzle.bank,
        inputIds: puzzle.inputIds,
        answerKey: puzzle.answers,
      },
    ],
  };
}

const numbersOf = (grid) =>
  grid.flat().filter((cell) => cell?.type === "number");

describe("faixas de dificuldade", () => {
  it("dailyStep sobe um degrau a cada 3 acertos e para no 8", () => {
    expect(dailyStep(0, 0)).toBe(0);
    expect(dailyStep(0, 2)).toBe(0);
    expect(dailyStep(0, 3)).toBe(1);
    expect(dailyStep(3, 6)).toBe(5);
    expect(dailyStep(6, 30)).toBe(8);
  });

  it("trackForStep agrupa os degraus em três faixas", () => {
    expect([0, 2, 3, 5, 6, 8].map(trackForStep)).toEqual([
      "easy",
      "easy",
      "medium",
      "medium",
      "hard",
      "hard",
    ]);
  });

  it("cada dificuldade começa no seu degrau do desafio diário", () => {
    expect(DAILY_START_STEP).toEqual({
      easy: 0,
      medium: 3,
      hard: 6,
    });
  });
});

describe("generateTrackPuzzle", () => {
  it.each(["easy", "medium", "hard"])(
    "%s segue as regras da faixa e é determinístico",
    (track) => {
      const rules = TRACKS[track];
      for (let i = 0; i < 12; i += 1) {
        const args = {
          operations: ["+", "−", "×", "÷"],
          track,
          seed: `teste-${track}-${i}`,
        };
        const puzzle = generateTrackPuzzle(args);
        expect(generateTrackPuzzle(args)).toEqual(puzzle);
        expect(validateCatalog(asCatalog(puzzle, track))).toEqual([]);

        const blanks = puzzle.inputIds.length;
        expect(blanks).toBeGreaterThanOrEqual(rules.blanks[0]);
        expect(blanks).toBeLessThanOrEqual(rules.blanks[1]);
        const values = [
          ...numbersOf(puzzle.grid)
            .filter((cell) => cell.value !== undefined)
            .map((cell) => cell.value),
          ...Object.values(puzzle.answers),
        ];
        expect(Math.max(...values)).toBeLessThanOrEqual(rules.maxValue);

        const stalls = countStalls(findEquations(puzzle.grid), puzzle.inputIds);
        expect(stalls).toBeGreaterThanOrEqual(rules.stalls.min);
        expect(stalls).toBeLessThanOrEqual(rules.stalls.max);
      }
    },
  );

  it("usa só as operações pedidas", () => {
    const puzzle = generateTrackPuzzle({
      operations: ["+"],
      track: "easy",
      seed: "somente-soma",
    });
    const operators = puzzle.grid
      .flat()
      .filter((cell) => cell?.type === "operator")
      .map((cell) => cell.value);
    expect(new Set(operators)).toEqual(new Set(["+"]));
  });

  it("respeita um mínimo de travamentos pedido", () => {
    const puzzle = generateTrackPuzzle({
      operations: ["+", "−"],
      track: "hard",
      seed: "dois-travamentos",
      minStalls: 2,
    });
    expect(
      countStalls(findEquations(puzzle.grid), puzzle.inputIds),
    ).toBeGreaterThanOrEqual(2);
  });
});
