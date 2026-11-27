// Teste de nivelamento adaptativo: primeiro descobre até qual operação o aluno
// vai bem (capítulo), depois em qual dificuldade geral ele deve começar.

/** Tempo de referência por cruzadinha; acima do dobro, o acerto vale meio. */
export const REFERENCE_SECONDS = { easy: 40, medium: 60, hard: 90 };

const LAST_OPERATION_CHAPTER = 4;
const FINAL_CHAPTER = 5;
const CHAPTER_OPERATIONS = {
  1: ["+"],
  2: ["−", "+"],
  3: ["×", "+"],
  4: ["÷", "+"],
};
const LOWER = { hard: "medium", medium: "easy", easy: "easy" };

export function createPlacement() {
  return {
    phase: "operations",
    chapter: 1,
    passedChapter: 0,
    failedChapter: null,
    difficultyTrack: "medium",
    scores: {},
  };
}

/** Próxima cruzadinha a gerar ({ operations, track, seed }) ou null no fim. */
export function nextPuzzle(state) {
  if (state.phase === "operations")
    return {
      operations: CHAPTER_OPERATIONS[state.chapter],
      track: "easy",
      seed: `placement-chapter-${state.chapter}`,
    };
  if (state.phase === "difficulty")
    return {
      operations: CHAPTER_OPERATIONS[Math.max(1, state.passedChapter)],
      track: state.difficultyTrack,
      seed: `placement-${state.difficultyTrack}`,
    };
  return null;
}

function scoreOf(track, { correct, seconds }) {
  if (!correct) return 0;
  return seconds > REFERENCE_SECONDS[track] * 2 ? 0.5 : 1;
}

export function recordAnswer(state, answer) {
  const puzzle = nextPuzzle(state);
  if (!puzzle) return state;
  const score = scoreOf(puzzle.track, answer);

  if (state.phase === "operations") {
    if (score === 0)
      return { ...state, phase: "difficulty", failedChapter: state.chapter };
    const finishedOperations = state.chapter === LAST_OPERATION_CHAPTER;
    return {
      ...state,
      passedChapter: state.chapter,
      chapter: finishedOperations ? state.chapter : state.chapter + 1,
      phase: finishedOperations ? "difficulty" : "operations",
    };
  }

  const scores = { ...state.scores, [state.difficultyTrack]: score };
  if (state.difficultyTrack === "medium" && score > 0)
    return { ...state, scores, difficultyTrack: "hard" };
  return { ...state, scores, phase: "done" };
}

/** { chapter, difficulty } indicados pelo teste. */
export function placementResult(state) {
  const chapter = state.failedChapter ?? FINAL_CHAPTER;
  const { medium = 0, hard = 0 } = state.scores;
  let difficulty = "easy";
  if (medium > 0) difficulty = hard > 0 ? "hard" : "medium";
  // Acertou, mas devagar em tudo o que decidiu a dificuldade: um degrau abaixo.
  const deciding = [medium, hard].filter((score) => score > 0);
  if (deciding.length > 0 && deciding.every((score) => score < 1))
    difficulty = LOWER[difficulty];
  return { chapter, difficulty };
}
