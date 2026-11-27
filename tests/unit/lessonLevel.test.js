import { readFileSync } from "node:fs";
import { LEVELS } from "lib/game/levels.js";
import { levelForDifficulty } from "lib/game/lessonLevel.js";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);

describe("levelForDifficulty", () => {
  it("usa a versão do catálogo na dificuldade pedida", () => {
    const level = catalog.levels[0];
    const lesson = levelForDifficulty(level, "hard");
    expect(lesson.track).toBe("hard");
    expect(lesson.difficulty).toBe(level.difficulty);
    expect(lesson.title).toBe(level.title);
    expect(lesson.xpReward).toBe(level.variants.hard.xpReward);
    expect(lesson.puzzles).toBe(level.variants.hard.puzzles);
    expect(lesson.variants).toBeUndefined();
  });

  it("cai para medium com dificuldade desconhecida ou ausente", () => {
    const level = catalog.levels[0];
    expect(levelForDifficulty(level, "expert").track).toBe("medium");
    expect(levelForDifficulty(level, undefined).track).toBe("medium");
  });

  it("gera 4 cruzadinhas com respostas para os níveis de visitante", () => {
    const lesson = levelForDifficulty(LEVELS[0], "easy");
    expect(lesson.puzzles).toHaveLength(4);
    for (const puzzle of lesson.puzzles) {
      expect(Object.keys(puzzle.answers).sort()).toEqual(
        [...puzzle.inputIds].sort(),
      );
      for (const id of puzzle.inputIds)
        expect(puzzle.bank).toContain(puzzle.answers[id]);
    }
  });

  it("visitante recebe cruzadinhas com respostas mesmo para nível do catálogo", () => {
    const level = catalog.levels[4];
    const lesson = levelForDifficulty(level, "medium", { guest: true });
    expect(lesson.puzzles).toHaveLength(4);
    for (const puzzle of lesson.puzzles)
      expect(Object.keys(puzzle.answers).sort()).toEqual(
        [...puzzle.inputIds].sort(),
      );
    const operators = new Set(
      lesson.puzzles
        .flatMap((puzzle) => puzzle.grid.flat())
        .filter((cell) => cell?.type === "operator")
        .map((cell) => cell.value),
    );
    const catalogOperators = new Set(
      level.variants.medium.puzzles
        .flatMap((puzzle) => puzzle.grid.flat())
        .filter((cell) => cell?.type === "operator")
        .map((cell) => cell.value),
    );
    for (const op of operators) expect(catalogOperators).toContain(op);
  });

  it("gera sempre as mesmas cruzadinhas para o mesmo nível e dificuldade", () => {
    expect(levelForDifficulty(LEVELS[3], "medium")).toEqual(
      levelForDifficulty(LEVELS[3], "medium"),
    );
    expect(levelForDifficulty(LEVELS[3], "medium").puzzles).not.toEqual(
      levelForDifficulty(LEVELS[3], "hard").puzzles,
    );
  });
});
