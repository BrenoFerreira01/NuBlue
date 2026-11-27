// Gerador determinístico de cruzadinhas conectadas por dificuldade geral.
// A mesma semente gera sempre a mesma grade, no navegador ou no servidor.
import { createSeededRandom } from "./dailyChallenge.js";
import { TRACKS } from "./tracks.mjs";
import {
  countStalls,
  findEquations,
  validateCatalog,
} from "../../infra/catalog-validation.mjs";

// Nove células de uma grade 5×5 com três linhas e três colunas de contas.
const GRID_CELLS = {
  A: [0, 0],
  B: [0, 2],
  C: [0, 4],
  D: [2, 0],
  E: [2, 2],
  F: [2, 4],
  G: [4, 0],
  H: [4, 2],
  I: [4, 4],
};

// Células numéricas ([linha, coluna]) e contas ([direção, esquerda, direita,
// resultado]) de cada estrutura, na ordem em que os valores são sorteados.
// opGroups: contas que precisam usar a mesma operação.
export const STRUCTURES = {
  gancho: {
    size: [5, 5],
    cells: {
      A: [0, 0],
      B: [0, 2],
      C: [0, 4],
      D: [2, 0],
      E: [4, 0],
      F: [4, 2],
      G: [4, 4],
    },
    eqs: [
      ["h", "A", "B", "C"],
      ["v", "A", "D", "E"],
      ["h", "E", "F", "G"],
    ],
  },
  escada: {
    size: [5, 7],
    cells: {
      A: [0, 0],
      B: [0, 2],
      C: [0, 4],
      D: [2, 4],
      E: [4, 4],
      F: [4, 2],
      G: [4, 6],
    },
    eqs: [
      ["h", "A", "B", "C"],
      ["v", "C", "D", "E"],
      ["h", "F", "E", "G"],
    ],
  },
  anel: {
    size: [5, 5],
    cells: {
      A: [0, 0],
      B: [0, 2],
      C: [0, 4],
      D: [2, 0],
      E: [2, 2],
      F: [2, 4],
      G: [4, 0],
      H: [4, 2],
    },
    eqs: [
      ["h", "A", "B", "C"],
      ["h", "D", "E", "F"],
      ["v", "A", "D", "G"],
      ["v", "B", "E", "H"],
    ],
  },
  cruz: {
    size: [5, 5],
    cells: { Z: [0, 2], L: [2, 0], X: [2, 2], Y: [2, 4], R: [4, 2] },
    eqs: [
      ["h", "L", "X", "Y"],
      ["v", "Z", "X", "R"],
    ],
  },
  "2x3": {
    size: [5, 5],
    cells: GRID_CELLS,
    eqs: [
      ["h", "A", "B", "C"],
      ["h", "D", "E", "F"],
      ["v", "A", "D", "G"],
      ["v", "B", "E", "H"],
      ["v", "C", "F", "I"],
    ],
  },
  "3x2": {
    size: [5, 5],
    cells: GRID_CELLS,
    eqs: [
      ["h", "A", "B", "C"],
      ["h", "D", "E", "F"],
      ["v", "A", "D", "G"],
      ["v", "B", "E", "H"],
      ["h", "G", "H", "I"],
    ],
  },
  cauda: {
    size: [5, 7],
    cells: { ...GRID_CELLS, J: [4, 6] },
    eqs: [
      ["h", "A", "B", "C"],
      ["h", "D", "E", "F"],
      ["v", "A", "D", "G"],
      ["v", "B", "E", "H"],
      ["h", "H", "I", "J"],
    ],
  },
  // Três linhas e três colunas. Linhas com a mesma operação e colunas com a
  // mesma operação fecham a última conta (ex.: + e −, × e ÷).
  grade3x3: {
    size: [5, 5],
    cells: GRID_CELLS,
    eqs: [
      ["h", "A", "B", "C"],
      ["h", "D", "E", "F"],
      ["v", "A", "D", "G"],
      ["v", "B", "E", "H"],
      ["v", "C", "F", "I"],
      ["h", "G", "H", "I"],
    ],
    opGroups: [
      [0, 1, 5],
      [2, 3, 4],
    ],
  },
  // Escada de quatro degraus numa grade 7×7.
  escadaLonga: {
    size: [7, 7],
    cells: {
      A: [0, 0],
      B: [0, 2],
      C: [0, 4],
      D: [2, 4],
      E: [4, 4],
      F: [4, 2],
      G: [4, 6],
      H: [2, 6],
      I: [6, 6],
    },
    eqs: [
      ["h", "A", "B", "C"],
      ["v", "C", "D", "E"],
      ["h", "F", "E", "G"],
      ["v", "H", "G", "I"],
    ],
  },
};

const MAX_ATTEMPTS = 3000;

const randInt = (random, low, high) =>
  low + Math.floor(random() * (high - low + 1));
const pick = (random, list) => list[Math.floor(random() * list.length)];
function shuffle(random, list) {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function combinations(list, size) {
  if (size === 0) return [[]];
  if (list.length < size) return [];
  const [head, ...rest] = list;
  return [
    ...combinations(rest, size - 1).map((combo) => [head, ...combo]),
    ...combinations(rest, size),
  ];
}

function assignOperations(random, structure, operations) {
  if (!structure.opGroups) {
    // Garante variedade: cada operação pedida aparece antes de repetir.
    const chosen = shuffle(random, operations).slice(0, structure.eqs.length);
    while (chosen.length < structure.eqs.length)
      chosen.push(pick(random, operations));
    return shuffle(random, chosen);
  }
  const ops = [];
  for (const group of structure.opGroups) {
    const op = pick(random, operations);
    for (const index of group) ops[index] = op;
  }
  return ops;
}

/** Sorteia os valores conta a conta; devolve null quando a tentativa não serve. */
function fillValues(random, structure, ops, rules, scale) {
  const operandMax = Math.max(3, Math.round(rules.operandMax * scale));
  const values = {};
  for (let i = 0; i < structure.eqs.length; i += 1) {
    const [, left, right, result] = structure.eqs[i];
    const op = ops[i];
    if (op === "+") {
      values[left] ??= randInt(random, 1, operandMax);
      values[right] ??= randInt(random, 1, operandMax);
    } else if (op === "−") {
      if (values[left] === undefined && values[right] === undefined) {
        values[right] = randInt(random, 1, operandMax);
        values[left] = values[right] + randInt(random, 1, operandMax);
      } else if (values[left] === undefined) {
        values[left] = values[right] + randInt(random, 1, operandMax);
      } else if (values[right] === undefined) {
        if (values[left] < 2) return null;
        values[right] = randInt(random, 1, values[left] - 1);
      }
    } else if (op === "×") {
      values[left] ??= randInt(random, 2, rules.factorMax);
      values[right] ??= randInt(random, 2, rules.factorMax);
    } else if (op === "÷") {
      if (values[left] === undefined) {
        values[right] ??= randInt(random, 2, rules.divisorMax);
        values[left] = values[right] * randInt(random, 2, rules.quotientMax);
      } else if (values[right] === undefined) {
        const divisors = [];
        for (let d = 2; d <= Math.min(values[left] - 1, rules.divisorMax); d++)
          if (values[left] % d === 0) divisors.push(d);
        if (divisors.length === 0) return null;
        values[right] = pick(random, divisors);
      }
    }
    const a = values[left];
    const b = values[right];
    let computed;
    if (op === "+") computed = a + b;
    else if (op === "−") computed = a - b;
    else if (op === "×") computed = a * b;
    else computed = b > 1 && a % b === 0 ? a / b : NaN;
    if (!(computed >= 1)) return null;
    if (values[result] !== undefined && values[result] !== computed)
      return null;
    values[result] = computed;
  }
  const all = Object.values(values);
  if (all.some((value) => value < 1 || value > rules.maxValue)) return null;
  return values;
}

function buildGrid(structure, ops, values, blankIds) {
  const [rows, cols] = structure.size;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const [name, [row, col]] of Object.entries(structure.cells)) {
    grid[row][col] =
      name in blankIds
        ? { type: "number", inputId: blankIds[name] }
        : { type: "number", value: values[name] };
  }
  structure.eqs.forEach(([direction, left], index) => {
    const [row, col] = structure.cells[left];
    const vertical = direction === "v";
    const at = (offset) =>
      vertical ? [row + offset, col] : [row, col + offset];
    const [opRow, opCol] = at(1);
    const [eqRow, eqCol] = at(3);
    grid[opRow][opCol] = vertical
      ? { type: "operator", value: ops[index], isVertical: true }
      : { type: "operator", value: ops[index] };
    grid[eqRow][eqCol] = vertical
      ? { type: "equals", isVertical: true }
      : { type: "equals" };
  });
  return grid;
}

function crossingCells(structure) {
  const directions = {};
  for (const [direction, ...cells] of structure.eqs)
    for (const cell of cells) (directions[cell] ??= new Set()).add(direction);
  return new Set(
    Object.keys(directions).filter((cell) => directions[cell].size === 2),
  );
}

function buildBank(random, answers, values, rules) {
  const answerValues = [...new Set(Object.values(answers))];
  const pool = new Set();
  for (const answer of answerValues)
    for (const delta of [-3, -2, -1, 1, 2, 3])
      if (answer + delta >= 1 && answer + delta <= rules.maxValue)
        pool.add(answer + delta);
  for (const value of Object.values(values)) pool.add(value);
  const distractors = shuffle(
    random,
    [...pool].filter((value) => !answerValues.includes(value)),
  );
  const count = randInt(random, ...rules.distractors);
  return [...answerValues, ...distractors.slice(0, count)].sort(
    (a, b) => a - b,
  );
}

function isAccepted(puzzle, track, minStalls) {
  const rules = TRACKS[track];
  const stalls = countStalls(findEquations(puzzle.grid), puzzle.inputIds);
  if (stalls < Math.max(rules.stalls.min, minStalls)) return false;
  if (stalls > rules.stalls.max) return false;
  const catalog = {
    version: 1,
    chapters: [{ id: 1, title: "Gerada" }],
    bonus: null,
    levels: [
      {
        id: 1,
        chapter: 1,
        session: 1,
        isBonus: false,
        title: "Gerada",
        subtitle: "Gerada",
        emoji: "➕",
        difficulty: track,
        xpReward: 1,
        grid: puzzle.grid,
        bank: puzzle.bank,
        inputIds: puzzle.inputIds,
        answerKey: puzzle.answers,
      },
    ],
  };
  return validateCatalog(catalog).length === 0;
}

/**
 * Gera uma cruzadinha da faixa pedida. `operations` restringe os sinais,
 * `step` (0–2 dentro da faixa) aumenta os números aos poucos e `minStalls`
 * exige mais travamentos (sessões difíceis do Avançado).
 * Devolve { structure, grid, inputIds, bank, answers }.
 */
export function generateTrackPuzzle({
  operations,
  track,
  seed,
  step = 2,
  minStalls = 0,
}) {
  const rules = TRACKS[track];
  if (!rules) throw new Error(`dificuldade desconhecida: ${track}`);
  const random = createSeededRandom(`${track}:${seed}`);
  const scale = 0.6 + 0.2 * Math.min(2, Math.max(0, step));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const structureName = pick(random, rules.structures);
    const structure = STRUCTURES[structureName];
    const ops = assignOperations(random, structure, operations);
    const values = fillValues(random, structure, ops, rules, scale);
    if (!values) continue;

    const crossing = crossingCells(structure);
    const names = Object.keys(structure.cells);
    const size = randInt(random, ...rules.blanks);
    const options = shuffle(random, combinations(names, size))
      .filter((combo) => combo.some((name) => crossing.has(name)))
      .slice(0, 12);
    for (const combo of options) {
      const ordered = [...combo].sort((a, b) => {
        const [rowA, colA] = structure.cells[a];
        const [rowB, colB] = structure.cells[b];
        return rowA - rowB || colA - colB;
      });
      const blankIds = Object.fromEntries(
        ordered.map((name, index) => [name, `n${index + 1}`]),
      );
      const answers = Object.fromEntries(
        ordered.map((name) => [blankIds[name], values[name]]),
      );
      const puzzle = {
        structure: structureName,
        grid: buildGrid(structure, ops, values, blankIds),
        inputIds: ordered.map((name) => blankIds[name]),
        bank: buildBank(random, answers, values, rules),
        answers,
      };
      if (isAccepted(puzzle, track, minStalls)) return puzzle;
    }
  }
  throw new Error(`não foi possível gerar uma cruzadinha ${track} (${seed})`);
}
