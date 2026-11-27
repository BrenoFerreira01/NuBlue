// Fila de uma lição de 4 cruzadinhas, no estilo do Duolingo: nada avança
// sozinho, e a cruzadinha errada volta para o fim da fila até ser acertada.

export const LESSON_PUZZLES = 4;
export const LESSON_HEARTS = 3;

/** A dificuldade fica fixa: trocar em Ajustes não muda a lição aberta. */
export function createLesson(difficulty) {
  return {
    difficulty,
    queue: Array.from({ length: LESSON_PUZZLES }, (_, index) => index),
    missed: [],
    hearts: LESSON_HEARTS,
    checked: null,
    reviewing: false,
    done: false,
    failed: false,
  };
}

/** Registra a verificação da cruzadinha atual; quem avança é continueLesson. */
export function answerLesson(state, correct) {
  if (state.checked || state.done || state.failed) return state;
  if (correct) return { ...state, checked: "correct" };
  const hearts = state.hearts - 1;
  const current = state.queue[0];
  return {
    ...state,
    checked: "wrong",
    hearts,
    failed: hearts <= 0,
    missed: state.missed.includes(current)
      ? state.missed
      : [...state.missed, current],
  };
}

/** Botão Continuar: acerto sai da fila, erro volta para o fim. */
export function continueLesson(state) {
  if (!state.checked || state.failed) return state;
  const [current, ...rest] = state.queue;
  const queue = state.checked === "correct" ? rest : [...rest, current];
  return {
    ...state,
    queue,
    checked: null,
    done: queue.length === 0,
    reviewing: queue.length > 0 && state.missed.includes(queue[0]),
  };
}
