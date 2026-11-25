const DIFFICULTIES = new Set(["easy", "medium", "hard", "very_hard"]);
const OPERATIONS = {
  "+": (left, right) => left + right,
  "−": (left, right) => left - right,
  "×": (left, right) => left * right,
  "÷": (left, right) =>
    right !== 0 && left % right === 0 ? left / right : Number.NaN,
};
const MAX_ANSWER = 100_000;

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const isAnswerValue = (value) =>
  Number.isInteger(value) && value >= 0 && value <= MAX_ANSWER;

function validateCell(cell, errors, prefix) {
  if (cell === null) return;
  if (!isObject(cell)) {
    errors.push(`${prefix}: grid cell must be an object or null`);
    return;
  }
  if (cell.type === "number") {
    const hasValue = cell.value !== undefined;
    const hasInput = cell.inputId !== undefined;
    if (hasValue === hasInput)
      errors.push(
        `${prefix}: number cell needs exactly one of value or inputId`,
      );
    if (hasValue && !Number.isInteger(cell.value))
      errors.push(`${prefix}: number cell value must be an integer`);
    if (hasInput && !isNonEmptyString(cell.inputId))
      errors.push(`${prefix}: inputId must be a non-empty string`);
  } else if (cell.type === "operator") {
    if (!(cell.value in OPERATIONS))
      errors.push(`${prefix}: invalid operator ${cell.value}`);
  } else if (cell.type !== "equals") {
    errors.push(`${prefix}: invalid cell type ${cell.type}`);
  }
}

// Equations are five consecutive cells: number, operator, number, equals, number.
// Horizontal ones use plain operator/equals cells; vertical ones are marked isVertical.
function findEquations(grid) {
  const at = (x, y) => grid[y]?.[x] ?? null;
  const equations = [];
  const collect = (cells, vertical) => {
    const [left, operator, right, equals, result] = cells;
    if (!left || !operator || !right || !equals || !result) return;
    if (
      left.type !== "number" ||
      operator.type !== "operator" ||
      right.type !== "number"
    )
      return;
    if (equals.type !== "equals" || result.type !== "number") return;
    if (
      Boolean(operator.isVertical) !== vertical ||
      Boolean(equals.isVertical) !== vertical
    )
      return;
    equations.push({ left, operator: operator.value, right, result });
  };
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      collect(
        [0, 1, 2, 3, 4].map((offset) => at(x + offset, y)),
        false,
      );
      collect(
        [0, 1, 2, 3, 4].map((offset) => at(x, y + offset)),
        true,
      );
    }
  }
  return equations;
}

function validateLevel(level, { chapterIds, expectBonus }, errors) {
  const prefix = `level ${level?.id ?? "?"}`;
  if (!isObject(level)) {
    errors.push(`${prefix}: must be an object`);
    return;
  }
  if (level.isBonus !== expectBonus)
    errors.push(`${prefix}: isBonus must be ${expectBonus}`);
  if (!chapterIds.has(level.chapter))
    errors.push(`${prefix}: unknown chapter ${level.chapter}`);
  if (!Number.isInteger(level.session) || level.session < 1)
    errors.push(`${prefix}: session must be a positive integer`);
  for (const field of ["title", "subtitle", "emoji"]) {
    if (!isNonEmptyString(level[field]))
      errors.push(`${prefix}: ${field} is required`);
  }
  if (!DIFFICULTIES.has(level.difficulty))
    errors.push(`${prefix}: invalid difficulty ${level.difficulty}`);
  if (!Number.isInteger(level.xpReward) || level.xpReward < 1)
    errors.push(`${prefix}: xpReward must be a positive integer`);

  if (
    !Array.isArray(level.grid) ||
    level.grid.length === 0 ||
    !level.grid.every(Array.isArray)
  ) {
    errors.push(`${prefix}: grid must be a non-empty array of rows`);
    return;
  }
  const gridInputs = new Set();
  for (const row of level.grid) {
    for (const cell of row) {
      validateCell(cell, errors, prefix);
      if (cell?.type === "number" && isNonEmptyString(cell.inputId))
        gridInputs.add(cell.inputId);
    }
  }

  const inputIds = Array.isArray(level.inputIds) ? level.inputIds : [];
  if (!Array.isArray(level.inputIds) || inputIds.length === 0)
    errors.push(`${prefix}: inputIds must be a non-empty array`);
  if (new Set(inputIds).size !== inputIds.length)
    errors.push(`${prefix}: inputIds must be unique`);

  const answerKey = isObject(level.answerKey) ? level.answerKey : {};
  if (!isObject(level.answerKey))
    errors.push(`${prefix}: answerKey must be an object`);
  const bank = Array.isArray(level.bank) ? level.bank : [];
  if (!Array.isArray(level.bank) || !bank.every(Number.isInteger))
    errors.push(`${prefix}: bank must be an array of integers`);

  for (const inputId of inputIds) {
    if (!gridInputs.has(inputId))
      errors.push(
        `${prefix}: input ${inputId} is listed but never appears in the grid`,
      );
    if (!(inputId in answerKey))
      errors.push(`${prefix}: input ${inputId} has no answer`);
  }
  for (const inputId of gridInputs) {
    if (!inputIds.includes(inputId))
      errors.push(`${prefix}: grid input ${inputId} is missing from inputIds`);
  }
  for (const [inputId, answer] of Object.entries(answerKey)) {
    if (!inputIds.includes(inputId))
      errors.push(`${prefix}: answer for unknown input ${inputId}`);
    if (!isAnswerValue(answer))
      errors.push(
        `${prefix}: answer for ${inputId} must be an integer from 0 to ${MAX_ANSWER}`,
      );
    else if (!bank.includes(answer))
      errors.push(
        `${prefix}: answer ${answer} for ${inputId} is not in the number bank`,
      );
  }

  const equations = findEquations(level.grid);
  if (equations.length === 0) errors.push(`${prefix}: grid has no equation`);
  const valueOf = (cell) =>
    cell.inputId !== undefined ? answerKey[cell.inputId] : cell.value;
  for (const { left, operator, right, result } of equations) {
    const [a, b, c] = [valueOf(left), valueOf(right), valueOf(result)];
    if (![a, b, c].every(Number.isInteger) || !(operator in OPERATIONS))
      continue;
    if (OPERATIONS[operator](a, b) !== c)
      errors.push(`${prefix}: equation ${a}${operator}${b}=${c} does not hold`);
  }
}

/** Returns a list of human-readable problems; an empty list means the catalog is valid. */
export function validateCatalog(catalog) {
  const errors = [];
  if (!isObject(catalog)) return ["catalog must be an object"];
  if (!Number.isInteger(catalog.version) || catalog.version < 1)
    errors.push("version must be a positive integer");

  const chapters = Array.isArray(catalog.chapters) ? catalog.chapters : [];
  if (chapters.length === 0) errors.push("chapters must be a non-empty array");
  const chapterIds = new Set(chapters.map((chapter) => chapter?.id));
  if (
    chapterIds.size !== chapters.length ||
    ![...chapterIds].every((id) => Number.isInteger(id) && id >= 1)
  ) {
    errors.push("chapter ids must be unique positive integers");
  }
  for (const chapter of chapters) {
    if (!isNonEmptyString(chapter?.title))
      errors.push(`chapter ${chapter?.id}: title is required`);
  }

  const levels = Array.isArray(catalog.levels) ? catalog.levels : [];
  if (levels.length === 0) errors.push("levels must be a non-empty array");
  if (!levels.every((level, index) => level?.id === index + 1)) {
    errors.push(`level ids must be 1..${levels.length} in order`);
  }
  for (const level of levels)
    validateLevel(level, { chapterIds, expectBonus: false }, errors);

  if (catalog.bonus !== null && catalog.bonus !== undefined) {
    if (catalog.bonus?.id !== levels.length + 1)
      errors.push(`bonus id must be ${levels.length + 1}`);
    validateLevel(catalog.bonus, { chapterIds, expectBonus: true }, errors);
  }
  return errors;
}

export function assertValidCatalog(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) {
    throw new Error(`Invalid course catalog:\n- ${errors.join("\n- ")}`);
  }
}
