import {
  REFERENCE_SECONDS,
  createPlacement,
  nextPuzzle,
  placementResult,
  recordAnswer,
} from "lib/game/placement.js";

/** Responde o teste na ordem; `answers` é uma lista de [acertou, segundos]. */
function run(answers) {
  let state = createPlacement();
  const asked = [];
  for (const [correct, seconds] of answers) {
    const puzzle = nextPuzzle(state);
    if (!puzzle) break;
    asked.push(puzzle);
    state = recordAnswer(state, { correct, seconds });
  }
  return { state, asked };
}
const fast = (correct) => [correct, 10];

describe("teste de nivelamento adaptativo", () => {
  it("começa com uma cruzadinha Iniciante de adição", () => {
    expect(nextPuzzle(createPlacement())).toMatchObject({
      track: "easy",
      operations: ["+"],
    });
  });

  it("tudo errado: capítulo 1, Iniciante", () => {
    const { state, asked } = run([fast(false), fast(false), fast(false)]);
    expect(placementResult(state)).toEqual({ chapter: 1, difficulty: "easy" });
    expect(nextPuzzle(state)).toBeNull();
    expect(asked.map((puzzle) => puzzle.track)).toEqual(["easy", "medium"]);
  });

  it("acertar +, − e × e errar ÷ indica o capítulo 4", () => {
    const { state } = run([
      fast(true),
      fast(true),
      fast(true),
      fast(false),
      fast(true),
      fast(false),
    ]);
    expect(placementResult(state).chapter).toBe(4);
  });

  it("tudo certo e rápido: capítulo 5, Avançado", () => {
    const { state, asked } = run(Array(6).fill(fast(true)));
    expect(asked).toHaveLength(6);
    expect(asked.slice(4).map((puzzle) => puzzle.track)).toEqual([
      "medium",
      "hard",
    ]);
    expect(placementResult(state)).toEqual({ chapter: 5, difficulty: "hard" });
  });

  it("acertar o Intermediário e errar o Avançado indica Intermediário", () => {
    const { state } = run([
      ...Array(4).fill(fast(true)),
      fast(true),
      fast(false),
    ]);
    expect(placementResult(state).difficulty).toBe("medium");
  });

  it("a fase de dificuldade usa a operação do último capítulo acertado", () => {
    const { asked } = run([fast(true), fast(true), fast(false), fast(true)]);
    expect(asked[3]).toMatchObject({ track: "medium", operations: ["−", "+"] });
  });

  it("acertos lentos nas duas cruzadinhas de dificuldade rebaixam um degrau", () => {
    const slow = [true, REFERENCE_SECONDS.hard * 3];
    const { state } = run([...Array(4).fill(fast(true)), slow, slow]);
    expect(placementResult(state)).toEqual({
      chapter: 5,
      difficulty: "medium",
    });
  });

  it("cada cruzadinha do teste tem semente própria e estável", () => {
    const first = run(Array(6).fill(fast(true))).asked;
    const second = run(Array(6).fill(fast(true))).asked;
    expect(first).toEqual(second);
    expect(new Set(first.map((puzzle) => puzzle.seed)).size).toBe(6);
  });
});
