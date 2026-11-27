import { answerLesson, continueLesson, createLesson } from "lib/game/lesson.js";

const play = (state, results) =>
  results.reduce(
    (current, correct) => continueLesson(answerLesson(current, correct)),
    state,
  );

describe("lição com revisão de erros", () => {
  it("começa pela 1ª cruzadinha, com 3 corações", () => {
    const lesson = createLesson("hard");
    expect(lesson).toMatchObject({
      difficulty: "hard",
      queue: [0, 1, 2, 3],
      hearts: 3,
      done: false,
      failed: false,
      reviewing: false,
      checked: null,
    });
  });

  it("acertar tudo termina depois da 4ª cruzadinha", () => {
    let lesson = createLesson("easy");
    for (let i = 0; i < 3; i += 1)
      lesson = continueLesson(answerLesson(lesson, true));
    expect(lesson.done).toBe(false);
    expect(continueLesson(answerLesson(lesson, true)).done).toBe(true);
  });

  it("não avança sozinho: só Continuar troca de cruzadinha", () => {
    const answered = answerLesson(createLesson("easy"), false);
    expect(answered.queue[0]).toBe(0);
    expect(answered.checked).toBe("wrong");
    expect(continueLesson(answered).queue[0]).toBe(1);
  });

  it("a cruzadinha errada volta no fim da fila", () => {
    const lesson = play(createLesson("medium"), [true, false]);
    expect(lesson.queue).toEqual([2, 3, 1]);
    expect(lesson.hearts).toBe(2);
    expect(lesson.reviewing).toBe(false);

    const review = play(lesson, [true, true]);
    expect(review.queue).toEqual([1]);
    expect(review.reviewing).toBe(true);
    expect(continueLesson(answerLesson(review, true)).done).toBe(true);
  });

  it("errar de novo na revisão a devolve para o fim mais uma vez", () => {
    const lesson = play(createLesson("medium"), [false, true, true, true]);
    expect(lesson.queue).toEqual([0]);
    const again = play(lesson, [false]);
    expect(again.queue).toEqual([0]);
    expect(again.hearts).toBe(1);
  });

  it("três erros esgotam os corações e a lição falha", () => {
    const answered = answerLesson(
      play(createLesson("easy"), [false, false]),
      false,
    );
    expect(answered.hearts).toBe(0);
    expect(answered.failed).toBe(true);
    expect(continueLesson(answered).failed).toBe(true);
  });

  it("guarda a dificuldade em que começou", () => {
    const lesson = play(createLesson("easy"), [true, false, true]);
    expect(lesson.difficulty).toBe("easy");
  });
});
