import type { Difficulty, GridCell, Level } from "../../types/game";

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function applyOp(a: number, b: number, op: string): number | null {
  switch (op) {
    case "+": return a + b;
    case "−": return a > b ? a - b : null;
    case "×": return a * b;
    case "÷": return b > 1 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function getRoundMeta(round: number): { subtitle: string; emoji: string; difficulty: Difficulty } {
  if (round <= 2) return { subtitle: "Adições simples", emoji: "⭐", difficulty: "easy" };
  if (round <= 4) return { subtitle: "Adição e subtração", emoji: "💫", difficulty: "easy" };
  if (round <= 7) return { subtitle: "Operações variadas", emoji: "🔥", difficulty: "medium" };
  if (round <= 11) return { subtitle: "Multiplicação intensa", emoji: "💎", difficulty: "hard" };
  return { subtitle: "Nível extremo", emoji: "🌪️", difficulty: "hard" };
}

export function generatePuzzle(round: number): Level {
  const ops =
    round <= 2 ? ["+"] :
    round <= 5 ? ["+", "−"] :
    round <= 9 ? ["+", "−", "×"] :
    ["+", "−", "×", "÷"];

  const maxNum = Math.min(3 + round * 2, 24);
  const numBlanks = round <= 7 ? 2 : 3;
  const meta = getRoundMeta(round);

  for (let attempt = 0; attempt < 800; attempt++) {
    const a = rand(1, maxNum);
    const b = rand(1, maxNum);
    const c = rand(1, maxNum);
    const d = rand(1, maxNum);
    const h1 = ops[rand(0, ops.length - 1)];
    const h2 = ops[rand(0, ops.length - 1)];
    const v1 = ops[rand(0, ops.length - 1)];
    const v2 = ops[rand(0, ops.length - 1)];
    const rh1 = applyOp(a, b, h1);
    const rh2 = applyOp(c, d, h2);
    const rv1 = applyOp(a, c, v1);
    const rv2 = applyOp(b, d, v2);

    if (rh1 == null || rh2 == null || rv1 == null || rv2 == null) continue;
    if (rh1 <= 0 || rh2 <= 0 || rv1 <= 0 || rv2 <= 0) continue;
    if (rh1 > 60 || rh2 > 60 || rv1 > 60 || rv2 > 60) continue;

    const corners = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const blankPos = corners.slice(0, numBlanks);
    const vals = [a, b, c, d];
    const ids = ["p", "q", "r", "s"];
    const answers: Record<string, number> = {};
    blankPos.forEach((pos) => { answers[ids[pos]] = vals[pos]; });

    function mkCell(val: number, idx: number): GridCell {
      return blankPos.includes(idx)
        ? { type: "number", inputId: ids[idx] }
        : { type: "number", value: val };
    }

    const grid: (GridCell | null)[][] = [
      [mkCell(a, 0), { type: "operator", value: h1 }, mkCell(b, 1), { type: "equals" }, { type: "number", value: rh1 }],
      [{ type: "operator", value: v1, isVertical: true }, null, { type: "operator", value: v2, isVertical: true }, null, null],
      [mkCell(c, 2), { type: "operator", value: h2 }, mkCell(d, 3), { type: "equals" }, { type: "number", value: rh2 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: rv1 }, null, { type: "number", value: rv2 }, null, null],
    ];

    const answerVals = Object.values(answers);
    const bankSet = new Set<number>(answerVals);
    let safety = 0;
    while (bankSet.size < 9 && safety < 200) {
      bankSet.add(rand(1, Math.max(maxNum + 5, 12)));
      safety++;
    }
    const bank = [...bankSet].sort(() => Math.random() - 0.5);

    return {
      id: -(round * 1000 + attempt),
      title: `Rodada ${round}`,
      subtitle: meta.subtitle,
      difficulty: meta.difficulty,
      xpReward: Math.floor(5 + round * 3),
      emoji: meta.emoji,
      grid,
      bank,
      answers,
    };
  }

  // Fallback: simple addition
  const a = rand(1, 5), b = rand(1, 5), c = rand(1, 5), d = rand(1, 5);
  return {
    id: -round,
    title: `Rodada ${round}`,
    subtitle: "Adições simples",
    difficulty: "easy",
    xpReward: 5,
    emoji: "⭐",
    grid: [
      [{ type: "number", inputId: "p" }, { type: "operator", value: "+" }, { type: "number", value: b }, { type: "equals" }, { type: "number", value: a + b }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "+", isVertical: true }, null, null],
      [{ type: "number", value: c }, { type: "operator", value: "+" }, { type: "number", inputId: "s" }, { type: "equals" }, { type: "number", value: c + d }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: a + c }, null, { type: "number", value: b + d }, null, null],
    ],
    bank: [...new Set([a, d, rand(1, 9), rand(1, 9), rand(1, 9), rand(1, 9)])].sort(() => Math.random() - 0.5),
    answers: { p: a, s: d },
  };
}
