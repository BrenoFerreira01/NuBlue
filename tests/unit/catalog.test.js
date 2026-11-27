import { readFileSync } from "node:fs";
import { validateCatalog } from "infra/catalog-validation.mjs";
import { generateTrackPuzzle } from "lib/game/trackPuzzle.mjs";
import { TRACK_IDS, sessionMinStalls, variantXp } from "lib/game/tracks.mjs";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);
const clone = (value) => structuredClone(value);
const errorsOf = (value) => validateCatalog(value).join("\n");
// 1ª cruzadinha da versão Intermediário do nível (a grade da versão 3).
const firstPuzzle = (level) => level.variants.medium.puzzles[0];
const firstCell = (puzzle, predicate) => {
  for (const row of puzzle.grid)
    for (const cell of row) if (cell && predicate(cell)) return cell;
  throw new Error("cell not found");
};

describe("catálogo do curso", () => {
  it("o catálogo publicado é válido", () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("o catálogo publicado está na versão 4, com três versões por nível", () => {
    expect(catalog.version).toBe(4);
    for (const level of catalog.levels) {
      expect(Object.keys(level.variants)).toEqual(["easy", "medium", "hard"]);
      expect(level.grid).toBeUndefined();
    }
  });

  it("o bônus fica desativado até ter uma grade consistente", () => {
    expect(catalog.bonus).toBeNull();
  });

  it("recusa resposta cuja entrada não aparece na grade", () => {
    const broken = clone(catalog);
    for (const row of firstPuzzle(broken.levels[0]).grid) {
      for (const cell of row) {
        if (cell?.inputId !== "l01-i1-01") continue;
        delete cell.inputId;
        cell.value = 3;
      }
    }
    expect(errorsOf(broken)).toMatch(
      /level 1: medium puzzle 1: input l01-i1-01 .*grid/,
    );
  });

  it("recusa resposta que não está no banco de números", () => {
    const broken = clone(catalog);
    const puzzle = firstPuzzle(broken.levels[0]);
    puzzle.bank = puzzle.bank.filter((value) => value !== 5);
    expect(errorsOf(broken)).toMatch(
      /level 1: medium puzzle 1: answer 5 .*bank/,
    );
  });

  it("recusa equação que não fecha", () => {
    const broken = clone(catalog);
    const puzzle = firstPuzzle(broken.levels[0]);
    puzzle.answerKey["l01-i1-01"] = 4;
    puzzle.bank.push(4);
    expect(errorsOf(broken)).toMatch(
      /level 1: medium puzzle 1: equation 4\+9=12/,
    );
  });

  it("exige ids sequenciais e capítulos existentes", () => {
    const broken = clone(catalog);
    broken.levels[1].id = 7;
    broken.levels[2].chapter = 9;
    const errors = errorsOf(broken);
    expect(errors).toMatch(/level ids must be 1\.\.39 in order/);
    expect(errors).toMatch(/level 3: unknown chapter 9/);
  });

  it("recusa células e dificuldades malformadas", () => {
    const broken = clone(catalog);
    broken.levels[0].difficulty = "impossible";
    firstCell(
      firstPuzzle(broken.levels[0]),
      (cell) => cell.type === "operator",
    ).value = "%";
    const errors = errorsOf(broken);
    expect(errors).toMatch(/level 1: invalid difficulty/);
    expect(errors).toMatch(/level 1: medium puzzle 1: invalid operator %/);
  });

  describe("cruzadinhas conectadas", () => {
    const n = (value) => ({ type: "number", value });
    const blank = (inputId) => ({ type: "number", inputId });
    const op = (value) => ({ type: "operator", value });
    const vop = (value) => ({ type: "operator", value, isVertical: true });
    const eq = { type: "equals" };
    const veq = { type: "equals", isVertical: true };
    const _ = null;

    // Gancho: a + 3 = 5 / a + 4 = e / e + f = 7
    const gancho = () => ({
      grid: [
        [blank("a"), op("+"), n(3), eq, n(5)],
        [vop("+"), _, _, _, _],
        [n(4), _, _, _, _],
        [veq, _, _, _, _],
        [blank("e"), op("+"), blank("f"), eq, n(7)],
      ],
      inputIds: ["a", "e", "f"],
      answerKey: { a: 2, e: 6, f: 1 },
      bank: [1, 2, 3, 4, 6, 8],
    });
    // Cruz: 14 − x = y / z + x = 9
    const cruz = () => ({
      difficulty: "hard",
      grid: [
        [_, _, blank("z"), _, _],
        [_, _, vop("+"), _, _],
        [n(14), op("−"), blank("x"), eq, blank("y")],
        [_, _, veq, _, _],
        [_, _, n(9), _, _],
      ],
      inputIds: ["x", "y", "z"],
      answerKey: { x: 6, y: 8, z: 3 },
      bank: [2, 3, 5, 6, 8, 9],
    });
    // Anel 2×2 com os quatro cantos vazios: 2+3=5 / 1+4=5 / 2−1=1 / 3+4=7
    const anel4 = () => ({
      grid: [
        [blank("a"), op("+"), blank("b"), eq, n(5)],
        [vop("−"), _, vop("+"), _, _],
        [blank("c"), op("+"), blank("d"), eq, n(5)],
        [veq, _, veq, _, _],
        [n(1), _, n(7), _, _],
      ],
      inputIds: ["a", "b", "c", "d"],
      answerKey: { a: 2, b: 3, c: 1, d: 4 },
      bank: [1, 2, 3, 4],
    });
    // Metadados do nível 1 sem as versões: fixtures de grade única.
    const legacyMetadata = () => {
      const { variants, ...metadata } = clone(catalog.levels[0]);
      return metadata;
    };
    const single = (level) => ({
      ...clone(catalog),
      bonus: null,
      levels: [
        {
          ...legacyMetadata(),
          difficulty: "easy",
          ...level,
          id: 1,
        },
      ],
    });
    const errorsFor = (level, options) =>
      validateCatalog(single(level), options).join("\n");

    it("aceita estruturas conectadas com solução única", () => {
      expect(validateCatalog(single(gancho()))).toEqual([]);
      expect(validateCatalog(single(cruz()))).toEqual([]);
    });

    it("recusa lacuna fora de qualquer conta", () => {
      const level = gancho();
      level.grid[2][2] = blank("z");
      level.inputIds.push("z");
      level.answerKey.z = 3;
      expect(errorsFor(level)).toMatch(
        /level 1: input z is not part of any equation/,
      );
    });

    it("exige ao menos uma lacuna num cruzamento", () => {
      const level = gancho();
      level.grid[0][0] = n(2);
      level.grid[0][2] = blank("b");
      level.grid[2][0] = blank("d");
      level.grid[4][0] = n(6);
      level.inputIds = ["b", "d", "f"];
      level.answerKey = { b: 3, d: 4, f: 1 };
      expect(errorsFor(level)).toMatch(
        /level 1: needs at least one blank on a crossing/,
      );
    });

    it("recusa contas que não formam uma única rede", () => {
      const level = {
        grid: [
          [blank("a"), op("+"), n(2), eq, n(5)],
          [_, _, _, _, _],
          [n(1), op("+"), blank("b"), eq, n(4)],
        ],
        inputIds: ["a", "b"],
        answerKey: { a: 3, b: 3 },
        bank: [1, 3, 5],
      };
      expect(errorsFor(level)).toMatch(
        /level 1: equations must form one connected crossword/,
      );
    });

    it("recusa grade maior que 7×7", () => {
      const level = gancho();
      level.grid = level.grid.map((row) => [...row, _, _, _]);
      expect(errorsFor(level)).toMatch(/level 1: grid must be at most 7×7/);
    });

    it("recusa banco que permite mais de uma solução", () => {
      const level = cruz();
      level.bank = [2, 3, 4, 5, 6, 8, 9];
      expect(errorsFor(level)).toMatch(
        /level 1: has more than one solution with the bank numbers/,
      );
    });

    it("exige dedução em cadeia nos níveis fáceis", () => {
      expect(errorsFor({ ...cruz(), difficulty: "easy" })).toMatch(
        /level 1: easy level must be solvable by chain deduction/,
      );
    });

    it("exige travamento nos níveis difíceis com 4 lacunas ou mais", () => {
      // 3H+2V: a×4=c / 2+e=7 / g+20=25 / a+2=g / 4×e=20
      const level = {
        difficulty: "hard",
        grid: [
          [blank("a"), op("×"), n(4), eq, blank("c")],
          [vop("+"), _, vop("×"), _, _],
          [n(2), op("+"), blank("e"), eq, n(7)],
          [veq, _, veq, _, _],
          [blank("g"), op("+"), n(20), eq, n(25)],
        ],
        inputIds: ["a", "c", "e", "g"],
        answerKey: { a: 3, c: 12, e: 5, g: 5 },
        bank: [3, 4, 5, 6, 7, 12],
      };
      expect(errorsFor(level)).toMatch(
        /level 1: hard level needs at least one deduction stall/,
      );
      expect(
        validateCatalog(single({ ...anel4(), difficulty: "hard" })),
      ).toEqual([]);
    });

    it("no modo não estrito aceita puzzles locais sem dedução em cadeia", () => {
      expect(validateCatalog(single(anel4()), { strict: false })).toEqual([]);
    });
  });

  it("valida o nível bônus como qualquer outro", () => {
    const broken = clone(catalog);
    broken.bonus = { ...clone(catalog.levels[0]), id: 40, isBonus: true };
    firstPuzzle(broken.bonus).answerKey["l01-i1-02"] = 7;
    expect(errorsOf(broken)).toMatch(/level 40: /);
  });
});

describe("catálogo v4: três versões por nível", () => {
  const TRACK_LETTER = { easy: "b", medium: "i", hard: "a" };
  const BASE_XP = 10;

  // Renomeia as lacunas n1, n2… para lNN-<faixa><cruzadinha>-MM.
  function renamed(puzzle, track, index) {
    const id = (n) =>
      `l01-${TRACK_LETTER[track]}${index + 1}-${String(n).padStart(2, "0")}`;
    const map = Object.fromEntries(
      puzzle.inputIds.map((old, i) => [old, id(i + 1)]),
    );
    return {
      grid: puzzle.grid.map((row) =>
        row.map((cell) =>
          cell?.inputId ? { ...cell, inputId: map[cell.inputId] } : cell,
        ),
      ),
      inputIds: puzzle.inputIds.map((old) => map[old]),
      bank: puzzle.bank,
      answerKey: Object.fromEntries(
        Object.entries(puzzle.answers).map(([old, v]) => [map[old], v]),
      ),
    };
  }

  function v4Level({ difficulty = "easy" } = {}) {
    const variants = {};
    for (const track of TRACK_IDS) {
      variants[track] = {
        xpReward: variantXp(BASE_XP, track),
        puzzles: [0, 1, 2, 3].map((index) =>
          renamed(
            generateTrackPuzzle({
              operations: ["+", "−"],
              track,
              seed: `v4-${track}-${index}`,
              minStalls: sessionMinStalls(track, difficulty),
            }),
            track,
            index,
          ),
        ),
      };
    }
    return {
      id: 1,
      chapter: 1,
      session: 1,
      isBonus: false,
      title: "Primeiras somas",
      subtitle: "Teste",
      emoji: "➕",
      difficulty,
      xpReward: BASE_XP,
      variants,
    };
  }
  const v4Catalog = (level) => ({
    version: 4,
    chapters: [{ id: 1, title: "Adição" }],
    levels: [level],
    bonus: null,
  });
  const v4Errors = (level) => validateCatalog(v4Catalog(level)).join("\n");

  it("aceita um nível com as três versões válidas", () => {
    expect(validateCatalog(v4Catalog(v4Level()))).toEqual([]);
  });

  it("exige as três versões", () => {
    const level = v4Level();
    delete level.variants.hard;
    expect(v4Errors(level)).toMatch(
      /level 1: variants must have easy, medium and hard/,
    );
  });

  it("exige 4 cruzadinhas por versão", () => {
    const level = v4Level();
    level.variants.easy.puzzles.pop();
    expect(v4Errors(level)).toMatch(
      /level 1: variant easy must have 4 puzzles/,
    );
  });

  it("recusa a mesma lacuna em duas cruzadinhas", () => {
    const level = v4Level();
    const first = level.variants.easy.puzzles[0];
    const second = level.variants.easy.puzzles[1];
    const oldId = second.inputIds[0];
    const newId = first.inputIds[0];
    second.inputIds[0] = newId;
    second.answerKey = Object.fromEntries(
      Object.entries(second.answerKey).map(([k, v]) => [
        k === oldId ? newId : k,
        v,
      ]),
    );
    for (const row of second.grid)
      for (const cell of row) if (cell?.inputId === oldId) cell.inputId = newId;
    expect(v4Errors(level)).toMatch(
      new RegExp(`level 1: input ${newId} is used more than once`),
    );
  });

  it("aplica as regras de travamento de cada faixa", () => {
    const level = v4Level();
    level.variants.easy.puzzles[1] = renamed(
      generateTrackPuzzle({
        operations: ["+", "−"],
        track: "hard",
        seed: "trava",
      }),
      "easy",
      1,
    );
    expect(v4Errors(level)).toMatch(
      /level 1: easy puzzle 2 must be solvable by chain deduction/,
    );
  });

  it("exige 2 travamentos no Avançado das sessões difíceis", () => {
    const level = v4Level();
    level.difficulty = "hard";
    expect(v4Errors(level)).toMatch(
      /level 1: hard puzzle \d needs at least 2 deduction stalls/,
    );
    expect(validateCatalog(v4Catalog(v4Level({ difficulty: "hard" })))).toEqual(
      [],
    );
  });

  it("recusa valores acima do limite da faixa", () => {
    const level = v4Level();
    const puzzle = level.variants.easy.puzzles[0];
    const given = puzzle.grid
      .flat()
      .find((cell) => cell?.type === "number" && cell.value !== undefined);
    given.value = 25;
    expect(v4Errors(level)).toMatch(/level 1: easy puzzle 1 uses 25, above 20/);
  });

  it("confere o XP de cada versão", () => {
    const level = v4Level();
    level.variants.hard.xpReward = 30;
    expect(v4Errors(level)).toMatch(
      /level 1: variant hard xpReward must be 20/,
    );
  });
});
