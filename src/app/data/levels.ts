import type { Difficulty, GridCell, Level } from "../types/game";

export interface Chapter {
  id: number;
  title: string;
  description: string;
}

type Operator = "+" | "−" | "×" | "÷";
interface PuzzleValues {
  a: number;
  b: number;
  c: number;
  d: number;
  top: Operator;
  bottom: Operator;
  left: Operator;
  right: Operator;
}

export const CHAPTERS: Chapter[] = [
  { id: 1, title: "Adição", description: "Some números e conecte os resultados." },
  { id: 2, title: "Subtração", description: "Encontre as diferenças em cada cruzamento." },
  { id: 3, title: "Multiplicação", description: "Use a tabuada para completar as equações." },
  { id: 4, title: "Divisão", description: "Divida em partes iguais e descubra os valores." },
  { id: 5, title: "Desafio final", description: "Combine as quatro operações em uma trilha final." },
];

const SESSION_TITLES = [
  ["Primeiras somas", "Somando em cruz", "Somas conectadas"],
  ["Diferenças simples", "Subtrações cruzadas", "Desafio das diferenças"],
  ["Tabuada em ação", "Produtos cruzados", "Multiplicação conectada"],
  ["Divisão exata", "Divisões cruzadas", "Desafio das divisões"],
  ["Operações combinadas", "Equações conectadas", "Grande desafio final"],
];

const CHAPTER_EMOJIS = ["➕", "➖", "✖️", "➗", "🌟"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function apply(a: number, b: number, operator: Operator) {
  switch (operator) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return a / b;
  }
}

function operatorCell(value: Operator, isVertical = false): GridCell {
  return { type: "operator", value, ...(isVertical ? { isVertical: true } : {}) };
}

function createLevel(id: number, chapter: number, session: number, values: PuzzleValues): Level {
  const topResult = apply(values.a, values.b, values.top);
  const bottomResult = apply(values.c, values.d, values.bottom);
  const leftResult = apply(values.a, values.c, values.left);
  const rightResult = apply(values.b, values.d, values.right);

  if (![topResult, bottomResult, leftResult, rightResult].every(Number.isInteger)) {
    throw new Error(`Capítulo ${chapter}, sessão ${session}: a cruzadinha precisa ter resultados inteiros.`);
  }

  const answers = { a: values.a, b: values.b, c: values.c, d: values.d };
  const answerValues = Object.values(answers);
  const distractors = Array.from(
    { length: Math.max(24, ...answerValues) },
    (_, index) => index + 1,
  ).filter((value) => !answerValues.includes(value));
  const bank = [...answerValues, ...distractors.slice(0, 4)].sort((a, b) => a - b);
  const chapterInfo = CHAPTERS[chapter - 1];
  const title = SESSION_TITLES[chapter - 1][session - 1];

  return {
    id,
    chapter,
    session,
    title,
    subtitle: chapterInfo.description,
    difficulty: DIFFICULTIES[session - 1],
    xpReward: 10 + (chapter - 1) * 5 + (session - 1) * 10,
    emoji: CHAPTER_EMOJIS[chapter - 1],
    grid: [
      [{ type: "number", inputId: "a" }, operatorCell(values.top), { type: "number", inputId: "b" }, { type: "equals" }, { type: "number", value: topResult }],
      [operatorCell(values.left, true), null, operatorCell(values.right, true), null, null],
      [{ type: "number", inputId: "c" }, operatorCell(values.bottom), { type: "number", inputId: "d" }, { type: "equals" }, { type: "number", value: bottomResult }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: leftResult }, null, { type: "number", value: rightResult }, null, null],
    ],
    bank,
    answers,
  };
}

export const LEVELS: Level[] = [
  // Capítulo 1 — Adição
  createLevel(1, 1, 1, { a: 2, b: 3, c: 1, d: 4, top: "+", bottom: "+", left: "+", right: "+" }),
  createLevel(2, 1, 2, { a: 4, b: 5, c: 2, d: 6, top: "+", bottom: "+", left: "+", right: "+" }),
  createLevel(3, 1, 3, { a: 7, b: 8, c: 3, d: 5, top: "+", bottom: "+", left: "+", right: "+" }),
  // Capítulo 2 — Subtração
  createLevel(4, 2, 1, { a: 12, b: 5, c: 7, d: 3, top: "−", bottom: "−", left: "−", right: "−" }),
  createLevel(5, 2, 2, { a: 18, b: 7, c: 9, d: 4, top: "−", bottom: "−", left: "−", right: "−" }),
  createLevel(6, 2, 3, { a: 24, b: 9, c: 11, d: 5, top: "−", bottom: "−", left: "−", right: "−" }),
  // Capítulo 3 — Multiplicação
  createLevel(7, 3, 1, { a: 2, b: 3, c: 4, d: 5, top: "×", bottom: "×", left: "×", right: "×" }),
  createLevel(8, 3, 2, { a: 3, b: 4, c: 2, d: 5, top: "×", bottom: "×", left: "×", right: "×" }),
  createLevel(9, 3, 3, { a: 4, b: 5, c: 3, d: 6, top: "×", bottom: "×", left: "×", right: "×" }),
  // Capítulo 4 — Divisão
  createLevel(10, 4, 1, { a: 24, b: 4, c: 8, d: 2, top: "÷", bottom: "÷", left: "÷", right: "÷" }),
  createLevel(11, 4, 2, { a: 48, b: 8, c: 12, d: 4, top: "÷", bottom: "÷", left: "÷", right: "÷" }),
  createLevel(12, 4, 3, { a: 72, b: 12, c: 18, d: 3, top: "÷", bottom: "÷", left: "÷", right: "÷" }),
  // Capítulo 5 — Desafio final
  createLevel(13, 5, 1, { a: 3, b: 4, c: 5, d: 2, top: "×", bottom: "+", left: "+", right: "+" }),
  createLevel(14, 5, 2, { a: 4, b: 6, c: 9, d: 3, top: "×", bottom: "−", left: "+", right: "+" }),
  createLevel(15, 5, 3, { a: 5, b: 8, c: 9, d: 4, top: "×", bottom: "+", left: "×", right: "+" }),
];

export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

export const DIFF_CHIP: Record<Difficulty, string> = {
  easy: "bg-success/15 text-success-foreground dark:bg-emerald-500/20 dark:text-emerald-400",
  medium: "bg-warning text-warning-foreground dark:bg-amber-500/20 dark:text-amber-400",
  hard: "bg-destructive/10 text-destructive dark:bg-red-500/20 dark:text-red-400",
};
