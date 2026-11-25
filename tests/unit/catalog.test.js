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
    expect(errorsOf(broken)).toMatch(/level 1: equation 4\+2=5/);
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

  it("valida o nível bônus como qualquer outro", () => {
    const broken = clone(catalog);
    broken.bonus = { ...clone(catalog.levels[0]), id: 40, isBonus: true };
    broken.bonus.answerKey["l01-e02"] = 9;
    expect(errorsOf(broken)).toMatch(/level 40: /);
  });
});
