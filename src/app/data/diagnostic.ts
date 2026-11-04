export interface DiagnosticQuestion {
  id: number;
  label: string;
  expression: string;
  options: number[];
  answer: number;
}

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  { id: 1, label: "Adição", expression: "7 + 5", options: [10, 11, 12, 13], answer: 12 },
  { id: 2, label: "Subtração", expression: "18 − 9", options: [7, 8, 9, 10], answer: 9 },
  { id: 3, label: "Multiplicação", expression: "7 × 6", options: [36, 40, 42, 48], answer: 42 },
  { id: 4, label: "Divisão", expression: "72 ÷ 8", options: [7, 8, 9, 10], answer: 9 },
  { id: 5, label: "Operações mistas", expression: "6 × 8 − 13", options: [33, 35, 37, 39], answer: 35 },
  { id: 6, label: "Desafio final", expression: "96 ÷ 6 + 17", options: [31, 32, 33, 34], answer: 33 },
];
