// Regras das três dificuldades gerais (Iniciante, Intermediário, Avançado).
// Valem para o catálogo, o desafio diário e o teste de nivelamento.

export const TRACK_IDS = ["easy", "medium", "hard"];

export const TRACKS = {
  easy: {
    structures: ["gancho", "escada", "anel"],
    blanks: [2, 3],
    maxValue: 20,
    stalls: { min: 0, max: 0 },
    distractors: [2, 3],
    xpMultiplier: 1,
    // Limites para sortear operandos: soma/subtração, fatores e divisores.
    operandMax: 10,
    factorMax: 4,
    divisorMax: 4,
    quotientMax: 5,
  },
  medium: {
    structures: ["anel", "2x3", "3x2", "cauda", "cruz"],
    blanks: [3, 4],
    maxValue: 50,
    stalls: { min: 0, max: 1 },
    distractors: [3, 3],
    xpMultiplier: 1.5,
    operandMax: 25,
    factorMax: 9,
    divisorMax: 9,
    quotientMax: 10,
  },
  hard: {
    structures: ["grade3x3", "escadaLonga", "cauda", "2x3", "3x2"],
    blanks: [5, 7],
    maxValue: 120,
    stalls: { min: 1, max: Infinity },
    distractors: [3, 4],
    xpMultiplier: 2,
    operandMax: 60,
    factorMax: 12,
    divisorMax: 12,
    quotientMax: 12,
  },
};

export const LABELS = {
  easy: "Iniciante",
  medium: "Intermediário",
  hard: "Avançado",
};

/** Degrau inicial do desafio diário para cada dificuldade geral. */
export const DAILY_START_STEP = { easy: 0, medium: 3, hard: 6 };
export const MAX_DAILY_STEP = 8;

/** Sobe um degrau a cada 3 acertos, até o degrau 8. */
export function dailyStep(start, solved) {
  return Math.min(MAX_DAILY_STEP, start + Math.floor(solved / 3));
}

/** Degraus 0–2 = Iniciante, 3–5 = Intermediário, 6–8 = Avançado. */
export function trackForStep(step) {
  return TRACK_IDS[Math.min(2, Math.floor(step / 3))];
}

/** XP da versão de um nível: o XP base vezes o multiplicador da faixa. */
export function variantXp(baseXp, track) {
  return Math.round(baseXp * TRACKS[track].xpMultiplier);
}

/** Travamentos mínimos exigidos pela sessão: 2 no Avançado das sessões difíceis. */
export function sessionMinStalls(track, difficulty) {
  return track === "hard" && difficulty === "hard" ? 2 : 0;
}
