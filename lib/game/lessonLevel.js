// Monta a lição de um nível na dificuldade escolhida. Níveis do catálogo já
// trazem as três versões (sem respostas); os níveis de visitante geram as 4
// cruzadinhas na hora, de forma determinística, com as respostas.
import { generateTrackPuzzle } from "lib/game/trackPuzzle.mjs";
import { TRACK_IDS, sessionMinStalls, variantXp } from "lib/game/tracks.mjs";
import { LESSON_PUZZLES } from "lib/game/lesson.js";

const DEFAULT_DIFFICULTY = "medium";
const guestLessons = new Map();

const operationsOf = (grid) => [
  ...new Set(
    grid
      .flat()
      .filter((cell) => cell?.type === "operator")
      .map((cell) => cell.value),
  ),
];

// Sinais usados pelo nível: da grade única (visitante) ou das versões do catálogo.
function levelOperations(level) {
  if (level.grid) return operationsOf(level.grid);
  return [
    ...new Set(
      Object.values(level.variants).flatMap((variant) =>
        variant.puzzles.flatMap((puzzle) => operationsOf(puzzle.grid)),
      ),
    ),
  ];
}

function guestVariant(level, difficulty) {
  const key = `${level.id}:${difficulty}`;
  if (!guestLessons.has(key)) {
    const operations = levelOperations(level);
    guestLessons.set(key, {
      xpReward: variantXp(level.xpReward, difficulty),
      puzzles: Array.from({ length: LESSON_PUZZLES }, (_, index) => {
        const { grid, inputIds, bank, answers } = generateTrackPuzzle({
          operations,
          track: difficulty,
          seed: `guest-${level.id}-${difficulty}-${index + 1}`,
          step: level.session - 1,
          minStalls: sessionMinStalls(difficulty, level.difficulty),
        });
        return { grid, inputIds, bank, answers };
      }),
    });
  }
  return guestLessons.get(key);
}

/** { ...metadados do nível (com o difficulty da sessão), track, xpReward, puzzles } */
// O catálogo do servidor não traz respostas: o visitante, que confere no
// navegador, joga cruzadinhas geradas com as mesmas regras.
export function levelForDifficulty(level, difficulty, { guest = false } = {}) {
  const chosen = TRACK_IDS.includes(difficulty)
    ? difficulty
    : DEFAULT_DIFFICULTY;
  const { variants, grid, inputIds, bank, answers, answerKey, ...metadata } =
    level;
  const variant =
    variants && !guest ? variants[chosen] : guestVariant(level, chosen);
  return {
    ...metadata,
    track: chosen,
    xpReward: variant.xpReward,
    puzzles: variant.puzzles,
  };
}
