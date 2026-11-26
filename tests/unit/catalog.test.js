import { readFileSync } from "node:fs";
import { validateCatalog } from "infra/catalog-validation.mjs";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);
const clone = (value) => structuredClone(value);
const errorsOf = (value) => validateCatalog(value).join("\n");
const firstCell = (level, predicate) => {
  for (const row of level.grid)
    for (const cell of row) if (cell && predicate(cell)) return cell;
  throw new Error("cell not found");
};

describe("catálogo do curso", () => {
  it("o catálogo publicado é válido", () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("o bônus fica desativado até ter uma grade consistente", () => {
    expect(catalog.bonus).toBeNull();
  });

  it("recusa resposta cuja entrada não aparece na grade", () => {
    const broken = clone(catalog);
    for (const row of broken.levels[0].grid) {
      for (const cell of row) {
        if (cell?.inputId !== "l01-e01") continue;
        delete cell.inputId;
        cell.value = 3;
      }
    }
    expect(errorsOf(broken)).toMatch(/level 1: input l01-e01 .*grid/);
  });

  it("recusa resposta que não está no banco de números", () => {
    const broken = clone(catalog);
    broken.levels[0].bank = broken.levels[0].bank.filter(
      (value) => value !== 5,
    );
    expect(errorsOf(broken)).toMatch(/level 1: answer 5 .*bank/);
  });

  it("recusa equação que não fecha", () => {
    const broken = clone(catalog);
    broken.levels[0].answerKey["l01-e01"] = 4;
    broken.levels[0].bank.push(4);
    expect(errorsOf(broken)).toMatch(/level 1: equation 4\+9=12/);
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
    firstCell(broken.levels[0], (cell) => cell.type === "operator").value = "%";
    const errors = errorsOf(broken);
    expect(errors).toMatch(/level 1: invalid difficulty/);
    expect(errors).toMatch(/level 1: invalid operator %/);
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
    const single = (level) => ({
      ...clone(catalog),
      bonus: null,
      levels: [
        {
          ...clone(catalog.levels[0]),
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
      expect(
        validateCatalog(single(anel4()), {
          strict: false,
        }),
      ).toEqual([]);
    });
  });

  it("valida o nível bônus como qualquer outro", () => {
    const broken = clone(catalog);
    broken.bonus = { ...clone(catalog.levels[0]), id: 40, isBonus: true };
    broken.bonus.answerKey["l01-e02"] = 7;
    expect(errorsOf(broken)).toMatch(/level 40: /);
  });
});
