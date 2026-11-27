import {
  TRACKS,
  TRACK_IDS,
  sessionMinStalls,
  variantXp,
} from "../lib/game/tracks.mjs";

export const PUZZLES_PER_LESSON = 4;
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

const MAX_GRID_SIZE = 7;
const MAX_SEARCH_STEPS = 200_000;

// Equations are five consecutive cells: number, operator, number, equals, number.
// Horizontal ones use plain operator/equals cells; vertical ones are marked isVertical.
// Each equation keeps the coordinates ("row,col") of its three number cells.
export function findEquations(grid) {
  const at = (x, y) => grid[y]?.[x] ?? null;
  const equations = [];
  const collect = (positions, orientation) => {
    const [left, operator, right, equals, result] = positions.map(([x, y]) =>
      at(x, y),
    );
    if (!left || !operator || !right || !equals || !result) return;
    if (
      left.type !== "number" ||
      operator.type !== "operator" ||
      right.type !== "number"
    )
      return;
    if (equals.type !== "equals" || result.type !== "number") return;
    const vertical = orientation === "vertical";
    if (
      Boolean(operator.isVertical) !== vertical ||
      Boolean(equals.isVertical) !== vertical
    )
      return;
    const numberPositions = [positions[0], positions[2], positions[4]];
    const keys = numberPositions.map(([x, y]) => `${y},${x}`);
    equations.push({
      orientation,
      left,
      operator: operator.value,
      right,
      result,
      keys,
    });
  };
  const offsets = [0, 1, 2, 3, 4];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      collect(
        offsets.map((offset) => [x + offset, y]),
        "horizontal",
      );
      collect(
        offsets.map((offset) => [x, y + offset]),
        "vertical",
      );
    }
  }
  return equations;
}

const numberCells = (equation) => [
  equation.left,
  equation.right,
  equation.result,
];

function isConnected(equations) {
  if (equations.length === 0) return true;
  const reached = new Set([0]);
  const pending = [0];
  while (pending.length) {
    const keys = new Set(equations[pending.pop()].keys);
    equations.forEach((equation, index) => {
      if (!reached.has(index) && equation.keys.some((key) => keys.has(key))) {
        reached.add(index);
        pending.push(index);
      }
    });
  }
  return reached.size === equations.length;
}

// Counts the solutions (stopping at 2) that use only bank values for the blanks.
// Returns null when the search grows too large to decide.
function countSolutions(equations, inputIds, bank) {
  const values = [...new Set(bank)];
  const assignment = {};
  const valueOf = (cell) =>
    cell.inputId !== undefined ? assignment[cell.inputId] : cell.value;
  const holds = ({ left, operator, right, result }) => {
    const [a, b, c] = [valueOf(left), valueOf(right), valueOf(result)];
    if (a === undefined || b === undefined || c === undefined) return true;
    return OPERATIONS[operator]?.(a, b) === c;
  };
  let solutions = 0;
  let steps = 0;
  (function search(index) {
    if (solutions > 1 || steps > MAX_SEARCH_STEPS) return;
    if (index === inputIds.length) {
      solutions += 1;
      return;
    }
    for (const value of values) {
      steps += 1;
      assignment[inputIds[index]] = value;
      if (equations.every(holds)) search(index + 1);
      delete assignment[inputIds[index]];
    }
  })(0);
  return steps > MAX_SEARCH_STEPS ? null : solutions;
}

// Solves blanks one equation at a time. A stall is a moment when no equation
// has exactly one unknown blank, so the player must reason across equations.
export function countStalls(equations, inputIds) {
  const known = new Set();
  const unknownIn = (equation) => [
    ...new Set(
      numberCells(equation)
        .map((cell) => cell.inputId)
        .filter((id) => id !== undefined && !known.has(id)),
    ),
  ];
  let stalls = 0;
  while (known.size < inputIds.length) {
    // Takes the first equation with the fewest unknown blanks.
    let fewest = null;
    for (const equation of equations) {
      const unknown = unknownIn(equation);
      if (unknown.length > 0 && (!fewest || unknown.length < fewest.length))
        fewest = unknown;
    }
    if (!fewest) break;
    if (fewest.length > 1) stalls += 1;
    known.add(fewest[0]);
  }
  return stalls;
}

// Topology and solution checks shared by every crossword. Returns the number
// of chain-deduction stalls in strict mode (null otherwise).
function validateCrossword(puzzle, equations, strict, errors, prefix) {
  const inputIds = Array.isArray(puzzle.inputIds) ? puzzle.inputIds : [];
  if (
    puzzle.grid.length > MAX_GRID_SIZE ||
    puzzle.grid.some((row) => row.length > MAX_GRID_SIZE)
  )
    errors.push(`${prefix}: grid must be at most 7×7`);

  const orientationsByInput = new Map();
  for (const equation of equations) {
    for (const cell of numberCells(equation)) {
      if (cell.inputId === undefined) continue;
      if (!orientationsByInput.has(cell.inputId))
        orientationsByInput.set(cell.inputId, new Set());
      orientationsByInput.get(cell.inputId).add(equation.orientation);
    }
  }
  for (const inputId of inputIds) {
    if (!orientationsByInput.has(inputId))
      errors.push(`${prefix}: input ${inputId} is not part of any equation`);
  }
  if (![...orientationsByInput.values()].some((set) => set.size === 2))
    errors.push(`${prefix}: needs at least one blank on a crossing`);
  if (!isConnected(equations))
    errors.push(`${prefix}: equations must form one connected crossword`);

  if (!strict) return null;
  const bank = Array.isArray(puzzle.bank) ? puzzle.bank : [];
  const solutions = countSolutions(equations, inputIds, bank);
  if (solutions === null)
    errors.push(`${prefix}: solution search is too large`);
  else if (solutions === 0)
    errors.push(`${prefix}: has no solution with the bank numbers`);
  else if (solutions > 1)
    errors.push(`${prefix}: has more than one solution with the bank numbers`);
  return countStalls(equations, inputIds);
}

// Grid, inputs, answers, bank and arithmetic of one crossword.
// Returns { stalls, values } or null when the grid is unusable.
function validatePuzzle(puzzle, strict, errors, prefix) {
  if (
    !Array.isArray(puzzle.grid) ||
    puzzle.grid.length === 0 ||
    !puzzle.grid.every(Array.isArray)
  ) {
    errors.push(`${prefix}: grid must be a non-empty array of rows`);
    return null;
  }
  const gridInputs = new Set();
  for (const row of puzzle.grid) {
    for (const cell of row) {
      validateCell(cell, errors, prefix);
      if (cell?.type === "number" && isNonEmptyString(cell.inputId))
        gridInputs.add(cell.inputId);
    }
  }

  const inputIds = Array.isArray(puzzle.inputIds) ? puzzle.inputIds : [];
  if (!Array.isArray(puzzle.inputIds) || inputIds.length === 0)
    errors.push(`${prefix}: inputIds must be a non-empty array`);
  if (new Set(inputIds).size !== inputIds.length)
    errors.push(`${prefix}: inputIds must be unique`);

  const answerKey = isObject(puzzle.answerKey) ? puzzle.answerKey : {};
  if (!isObject(puzzle.answerKey))
    errors.push(`${prefix}: answerKey must be an object`);
  const bank = Array.isArray(puzzle.bank) ? puzzle.bank : [];
  if (!Array.isArray(puzzle.bank) || !bank.every(Number.isInteger))
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

  const equations = findEquations(puzzle.grid);
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
  const values = puzzle.grid
    .flat()
    .filter((cell) => cell?.type === "number")
    .map(valueOf)
    .filter(Number.isInteger);
  const stalls =
    equations.length > 0
      ? validateCrossword(puzzle, equations, strict, errors, prefix)
      : null;
  return { stalls, values };
}

// Stall rules for single-grid (legacy, local and generated) levels.
function checkSessionStalls(difficulty, stalls, blanks, errors, prefix) {
  if (stalls === null) return;
  switch (difficulty) {
    case "easy":
      if (stalls > 0)
        errors.push(
          `${prefix}: easy level must be solvable by chain deduction`,
        );
      break;
    case "medium":
      if (stalls > 1)
        errors.push(
          `${prefix}: medium level allows at most one deduction stall`,
        );
      break;
    case "hard":
    case "very_hard":
      if (blanks >= 4 && stalls === 0)
        errors.push(`${prefix}: hard level needs at least one deduction stall`);
      break;
  }
}

// Track rules (spec table) for one crossword of a v4 variant.
function checkTrackRules(track, difficulty, puzzle, result, errors, prefix) {
  const rules = TRACKS[track];
  const blanks = Array.isArray(puzzle.inputIds) ? puzzle.inputIds.length : 0;
  const [minBlanks, maxBlanks] = rules.blanks;
  if (blanks < minBlanks || blanks > maxBlanks)
    errors.push(`${prefix} must have ${minBlanks}–${maxBlanks} blanks`);
  const above = result.values.find((value) => value > rules.maxValue);
  if (above !== undefined)
    errors.push(`${prefix} uses ${above}, above ${rules.maxValue}`);

  const { stalls } = result;
  if (stalls === null) return;
  const minStalls = Math.max(
    rules.stalls.min,
    sessionMinStalls(track, difficulty),
  );
  if (rules.stalls.max === 0 && stalls > 0)
    errors.push(`${prefix} must be solvable by chain deduction`);
  else if (stalls > rules.stalls.max)
    errors.push(`${prefix} allows at most one deduction stall`);
  if (stalls < minStalls)
    errors.push(
      minStalls === 1
        ? `${prefix} needs at least one deduction stall`
        : `${prefix} needs at least ${minStalls} deduction stalls`,
    );
}

function validateVariants(level, strict, errors, prefix) {
  const variants = isObject(level.variants) ? level.variants : {};
  if (!TRACK_IDS.every((track) => isObject(variants[track]))) {
    errors.push(`${prefix}: variants must have easy, medium and hard`);
    return;
  }
  const seenInputs = new Set();
  for (const track of TRACK_IDS) {
    const variant = variants[track];
    const expectedXp = variantXp(level.xpReward, track);
    if (variant.xpReward !== expectedXp)
      errors.push(`${prefix}: variant ${track} xpReward must be ${expectedXp}`);
    const puzzles = Array.isArray(variant.puzzles) ? variant.puzzles : [];
    if (puzzles.length !== PUZZLES_PER_LESSON)
      errors.push(
        `${prefix}: variant ${track} must have ${PUZZLES_PER_LESSON} puzzles`,
      );
    puzzles.forEach((puzzle, index) => {
      const puzzlePrefix = `${prefix}: ${track} puzzle ${index + 1}`;
      if (!isObject(puzzle)) {
        errors.push(`${puzzlePrefix} must be an object`);
        return;
      }
      const inputIds = Array.isArray(puzzle.inputIds) ? puzzle.inputIds : [];
      for (const inputId of inputIds) {
        if (seenInputs.has(inputId))
          errors.push(`${prefix}: input ${inputId} is used more than once`);
        seenInputs.add(inputId);
      }
      const result = validatePuzzle(puzzle, strict, errors, puzzlePrefix);
      if (result)
        checkTrackRules(
          track,
          level.difficulty,
          puzzle,
          result,
          errors,
          puzzlePrefix,
        );
    });
  }
}

function validateLevel(level, { chapterIds, expectBonus, strict }, errors) {
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

  // Catalog v4 levels carry three variants; local and generated puzzles
  // keep a single grid.
  if ("variants" in level) {
    validateVariants(level, strict, errors, prefix);
    return;
  }
  const result = validatePuzzle(level, strict, errors, prefix);
  if (result)
    checkSessionStalls(
      level.difficulty,
      result.stalls,
      Array.isArray(level.inputIds) ? level.inputIds.length : 0,
      errors,
      prefix,
    );
}

/**
 * Returns a list of human-readable problems; an empty list means the catalog is valid.
 * strict (default) also requires a unique solution over the bank and a number of
 * chain-deduction stalls that matches each level's difficulty.
 */
export function validateCatalog(catalog, { strict = true } = {}) {
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
    validateLevel(level, { chapterIds, expectBonus: false, strict }, errors);

  if (catalog.bonus !== null && catalog.bonus !== undefined) {
    if (catalog.bonus?.id !== levels.length + 1)
      errors.push(`bonus id must be ${levels.length + 1}`);
    validateLevel(
      catalog.bonus,
      { chapterIds, expectBonus: true, strict },
      errors,
    );
  }
  return errors;
}

export function assertValidCatalog(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) {
    throw new Error(`Invalid course catalog:\n- ${errors.join("\n- ")}`);
  }
}
