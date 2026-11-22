import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCatalog } from "../src/catalog/validate.js";
import { seedCourse } from "../src/db/seed.js";
import { catalog, createTestContext } from "./helpers.js";

const clone = (value) => structuredClone(value);
const firstCell = (level, predicate) => {
  for (const row of level.grid) for (const cell of row) if (cell && predicate(cell)) return cell;
  throw new Error("cell not found");
};

test("the shipped catalog is valid", () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test("the bonus stays disabled until a consistent grid is provided", () => {
  assert.equal(catalog.bonus, null);
});

test("an answer whose input never appears in the grid is rejected", () => {
  const broken = clone(catalog);
  for (const row of broken.levels[0].grid) {
    for (const cell of row) {
      if (cell?.inputId !== "l01-e01") continue;
      delete cell.inputId;
      cell.value = 3;
    }
  }
  assert.match(validateCatalog(broken).join("\n"), /level 1: input l01-e01 .*grid/);
});

test("an answer missing from the number bank is rejected", () => {
  const broken = clone(catalog);
  broken.levels[0].bank = broken.levels[0].bank.filter((value) => value !== 5);
  assert.match(validateCatalog(broken).join("\n"), /level 1: answer 5 .*bank/);
});

test("an equation that does not hold is rejected", () => {
  const broken = clone(catalog);
  broken.levels[0].answerKey["l01-e01"] = 4;
  broken.levels[0].bank.push(4);
  assert.match(validateCatalog(broken).join("\n"), /level 1: equation 4\+2=5/);
});

test("level ids must be sequential and chapters must exist", () => {
  const broken = clone(catalog);
  broken.levels[1].id = 7;
  broken.levels[2].chapter = 9;
  const errors = validateCatalog(broken).join("\n");
  assert.match(errors, /level ids must be 1\.\.39 in order/);
  assert.match(errors, /level 3: unknown chapter 9/);
});

test("malformed cells and difficulties are rejected", () => {
  const broken = clone(catalog);
  broken.levels[0].difficulty = "impossible";
  firstCell(broken.levels[0], (cell) => cell.type === "operator").value = "%";
  const errors = validateCatalog(broken).join("\n");
  assert.match(errors, /level 1: invalid difficulty/);
  assert.match(errors, /level 1: invalid operator %/);
});

test("a bonus level is validated like any other level", () => {
  const broken = clone(catalog);
  broken.bonus = { ...clone(catalog.levels[0]), id: 40, isBonus: true };
  broken.bonus.answerKey["l01-e02"] = 9;
  assert.match(validateCatalog(broken).join("\n"), /level 40: /);
});

test("seeding refuses an invalid catalog before writing anything", async () => {
  const ctx = await createTestContext({ seed: false });
  try {
    const broken = clone(catalog);
    broken.levels[0].answerKey["l01-e01"] = 4;
    await assert.rejects(() => seedCourse(ctx.pool, broken), /invalid course catalog/i);
    const { rows } = await ctx.pool.query("SELECT count(*)::integer AS count FROM course_levels", []);
    assert.equal(rows[0].count, 0);
  } finally {
    await ctx.close();
  }
});

test("with the bonus disabled the API never offers it", async () => {
  const ctx = await createTestContext();
  try {
    const { cookie, student } = await ctx.registerStudent();
    await ctx.pool.query(
      "INSERT INTO level_completions (student_id, level_id) SELECT $1, id FROM course_levels WHERE is_bonus = false",
      [student.id],
    );
    const availability = await ctx.request("GET", "/api/progress/availability", { cookie });
    assert.equal(availability.body.levels.every((level) => level.status === "completed"), true);
    assert.equal(availability.body.bonusAvailable, false);

    const bonus = await ctx.request("GET", "/api/catalog/bonus/very-hard", { cookie });
    assert.equal(bonus.status, 503);
    assert.equal(bonus.body.error, "bonus_unavailable");

    const attempt = await ctx.request("POST", "/api/attempts", {
      cookie, body: { levelId: 40, answers: { a: 9 }, idempotencyKey: "bonus-attempt-1" },
    });
    assert.equal(attempt.status, 404);
  } finally {
    await ctx.close();
  }
});
