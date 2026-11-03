import type { Difficulty, Level, LockedStub } from "../types/game";

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "Somando Certo",
    subtitle: "Descubra os números perdidos",
    difficulty: "easy",
    xpReward: 10,
    emoji: "⭐",
    grid: [
      [{ type: "number", inputId: "a" }, { type: "operator", value: "+" }, { type: "number", value: 3 }, { type: "equals" }, { type: "number", value: 8 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "+", isVertical: true }, null, null],
      [{ type: "number", value: 2 }, { type: "operator", value: "+" }, { type: "number", inputId: "b" }, { type: "equals" }, { type: "number", value: 6 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 7 }, null, { type: "number", value: 7 }, null, null],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    answers: { a: 5, b: 4 },
  },
  {
    id: 2,
    title: "Operações Mistas",
    subtitle: "Multiplicação e adição juntas",
    difficulty: "medium",
    xpReward: 20,
    emoji: "💫",
    grid: [
      [{ type: "number", inputId: "c" }, { type: "operator", value: "×" }, { type: "number", value: 4 }, { type: "equals" }, { type: "number", value: 20 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "−", isVertical: true }, null, null],
      [{ type: "number", value: 3 }, { type: "operator", value: "+" }, { type: "number", inputId: "d" }, { type: "equals" }, { type: "number", value: 5 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 8 }, null, { type: "number", value: 2 }, null, null],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8],
    answers: { c: 5, d: 2 },
  },
  {
    id: 3,
    title: "Triplo Desafio",
    subtitle: "Três incógnitas para resolver",
    difficulty: "hard",
    xpReward: 35,
    emoji: "🔥",
    grid: [
      [{ type: "number", inputId: "e" }, { type: "operator", value: "×" }, { type: "number", inputId: "f" }, { type: "equals" }, { type: "number", value: 12 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "−", isVertical: true }, null, null],
      [{ type: "number", inputId: "g" }, { type: "operator", value: "+" }, { type: "number", value: 2 }, { type: "equals" }, { type: "number", value: 7 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 8 }, null, { type: "number", value: 2 }, null, null],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    answers: { e: 3, f: 4, g: 5 },
  },
];

export const LOCKED_STUBS: LockedStub[] = [
  { id: 4, title: "Divisão em Ação", difficulty: "medium", emoji: "➗", isLocked: true },
  { id: 5, title: "Grande Mestre", difficulty: "hard", emoji: "🏆", isLocked: true },
];

export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};
export const DIFF_CHIP: Record<Difficulty, string> = {
  easy: "bg-success/15 text-success-foreground",
  medium: "bg-warning text-warning-foreground",
  hard: "bg-destructive/10 text-destructive",
};
