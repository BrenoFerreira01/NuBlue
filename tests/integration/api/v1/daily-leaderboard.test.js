import { createStudent, prepare, request } from "tests/orchestrator.js";
import { completeLesson } from "tests/catalog.js";
import { dailyPuzzle } from "lib/game/dailyRun.mjs";
import { DAILY_START_STEP } from "lib/game/tracks.mjs";

// A cruzadinha atual é gerada de novo a partir do que a API devolve.
const answersFor = (challenge) =>
  dailyPuzzle(
    challenge.date,
    challenge.startStep,
    challenge.currentIndex,
    challenge.score,
  ).puzzle.answers;
let keyCounter = 0;
const newKey = () => `daily-key-${process.pid}-${++keyCounter}`;

const getChallenge = (cookie) => request("/api/v1/daily-challenge", { cookie });
const submit = (cookie, body) =>
  request("/api/v1/daily-challenge/attempts", {
    method: "POST",
    cookie,
    body,
  });
const saveDraft = (cookie, answers) =>
  request("/api/v1/daily-challenge/draft", {
    method: "PUT",
    cookie,
    body: { answers },
  });
const wrongAnswersFor = (challenge) =>
  Object.fromEntries(challenge.level.inputIds.map((id) => [id, 0]));

beforeAll(prepare);

describe("/api/v1/daily-challenge", () => {
  it("começa na dificuldade geral do aluno, com 3 vidas, sem expor as respostas", async () => {
    const { cookie } = await createStudent();
    await request("/api/v1/users/me", {
      method: "PATCH",
      cookie,
      body: { difficulty: "hard" },
    });

    const response = await getChallenge(cookie);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      status: "in_progress",
      date: new Date().toISOString().slice(0, 10),
      hearts: 3,
      score: 0,
      currentIndex: 0,
      startStep: DAILY_START_STEP.hard,
      step: DAILY_START_STEP.hard,
    });
    expect(response.data.level.inputIds.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.data)).not.toMatch(/answer|answer_?key/i);
  });

  it("sem sessão responde 401", async () => {
    expect((await getChallenge()).status).toBe(401);
  });

  it("guarda o rascunho e recusa entradas desconhecidas", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);
    const [firstInput] = challenge.level.inputIds;

    const saved = await saveDraft(cookie, { [firstInput]: 7 });
    expect(saved.status).toBe(200);
    expect(saved.data).toEqual({ saved: true });
    expect((await getChallenge(cookie)).data.fills).toEqual({
      [firstInput]: 7,
    });

    const unknown = await saveDraft(cookie, { nope: 1 });
    expect(unknown.status).toBe(400);
    expect(unknown.data.error).toBe("invalid_answers");
  });

  it("acertar soma ponto e XP e passa para a próxima cruzadinha", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    const correct = await submit(cookie, {
      answers: answersFor(challenge),
      idempotencyKey: newKey(),
    });

    expect(correct.data).toMatchObject({
      correct: true,
      score: 1,
      hearts: 3,
      status: "in_progress",
      xpAwarded: 5 + challenge.step,
    });
    expect(correct.data.correctAnswers).toBeUndefined();
    expect(correct.data.progress.dailyChallengesCompleted).toBe(1);
    const next = await getChallenge(cookie);
    expect(next.data.currentIndex).toBe(1);
    expect(next.data.level.inputIds).not.toEqual(challenge.level.inputIds);
  });

  it("errar gasta uma vida, mostra a resposta certa e segue para a próxima", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    const wrong = await submit(cookie, {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    });

    expect(wrong.data).toMatchObject({
      correct: false,
      hearts: 2,
      score: 0,
      xpAwarded: 0,
      correctAnswers: answersFor(challenge),
    });
    expect((await getChallenge(cookie)).data.currentIndex).toBe(1);
  });

  it("continua de onde parou no mesmo dia", async () => {
    const { cookie } = await createStudent();
    const { data: first } = await getChallenge(cookie);
    await submit(cookie, {
      answers: wrongAnswersFor(first),
      idempotencyKey: newKey(),
    });

    const again = await getChallenge(cookie);
    const thirdTime = await getChallenge(cookie);
    expect(again.data).toMatchObject({ currentIndex: 1, hearts: 2 });
    expect(thirdTime.data.level).toEqual(again.data.level);
  });

  it("repetir a chave de idempotência não gasta outra vida", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);
    const body = {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    };

    await submit(cookie, body);
    const replay = await submit(cookie, body);

    expect(replay.data.replayed).toBe(true);
    expect(replay.data.hearts).toBe(2);
    expect((await getChallenge(cookie)).data.hearts).toBe(2);
  });

  it("o 3º erro encerra o desafio do dia", async () => {
    const { cookie } = await createStudent();
    let challenge = (await getChallenge(cookie)).data;
    await submit(cookie, {
      answers: answersFor(challenge),
      idempotencyKey: newKey(),
    });

    let last;
    for (let i = 0; i < 3; i += 1) {
      challenge = (await getChallenge(cookie)).data;
      last = await submit(cookie, {
        answers: wrongAnswersFor(challenge),
        idempotencyKey: newKey(),
      });
    }

    expect(last.data).toMatchObject({
      hearts: 0,
      score: 1,
      status: "completed",
    });
    const after = await submit(cookie, {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    });
    expect(after.status).toBe(409);
    expect(after.data.error).toBe("daily_challenge_finished");
  });

  it("sem nenhum acerto o dia falha e a sequência zera", async () => {
    const { cookie } = await createStudent();

    let last;
    for (let i = 0; i < 3; i += 1) {
      const challenge = (await getChallenge(cookie)).data;
      last = await submit(cookie, {
        answers: wrongAnswersFor(challenge),
        idempotencyKey: newKey(),
      });
    }

    expect(last.data).toMatchObject({ status: "failed", score: 0 });
    expect(last.data.progress.currentDailyStreak).toBe(0);
  });
});

describe("rate limit das tentativas", () => {
  const invalidAttempt = { levelId: 1, answers: {}, idempotencyKey: "x" };

  it("curso e desafio diário dividem 30 tentativas por minuto por conta", async () => {
    const { cookie } = await createStudent();
    for (let i = 0; i < 20; i += 1) {
      const response = await request("/api/v1/attempts", {
        method: "POST",
        cookie,
        body: invalidAttempt,
      });
      expect(response.status).toBe(400);
    }
    for (let i = 0; i < 10; i += 1) {
      expect(
        (await submit(cookie, { answers: {}, idempotencyKey: "x" })).status,
      ).toBe(400);
    }

    const limited = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: invalidAttempt,
    });
    expect(limited.status).toBe(429);
    expect(limited.data.error).toBe("too_many_attempts");
    expect(
      (await submit(cookie, { answers: {}, idempotencyKey: "x" })).status,
    ).toBe(429);

    const other = await createStudent();
    const unaffected = await request("/api/v1/attempts", {
      method: "POST",
      cookie: other.cookie,
      body: invalidAttempt,
    });
    expect(unaffected.status).toBe(400);
  });

  it("rascunhos têm um limite próprio, maior", async () => {
    const { cookie } = await createStudent();
    for (let i = 0; i < 30; i += 1) {
      await request("/api/v1/attempts", {
        method: "POST",
        cookie,
        body: invalidAttempt,
      });
    }
    expect((await saveDraft(cookie, {})).status).toBe(200);

    for (let i = 1; i < 120; i += 1) await saveDraft(cookie, {});

    expect((await saveDraft(cookie, {})).status).toBe(429);
  });
});

describe("GET /api/v1/leaderboard", () => {
  it("lista só quem aceitou aparecer e tem XP", async () => {
    const visible = await createStudent();
    const hidden = await createStudent();
    for (const student of [visible, hidden])
      await completeLesson(student.cookie, 1);
    await request("/api/v1/users/me", {
      method: "PATCH",
      cookie: visible.cookie,
      body: { leaderboardOptIn: true },
    });

    for (const period of ["weekly", "all"]) {
      const board = await request(`/api/v1/leaderboard?period=${period}`);
      const names = board.data.entries.map((entry) => entry.nickname);
      expect(board.data.period).toBe(period);
      expect(names).toContain(visible.nickname);
      expect(names).not.toContain(hidden.nickname);
      expect(Object.keys(board.data.entries[0]).sort()).toEqual([
        "nickname",
        "streak",
        "xp",
      ]);
    }
  });

  it("recusa período inválido", async () => {
    const invalid = await request("/api/v1/leaderboard?period=forever");

    expect(invalid.status).toBe(400);
    expect(invalid.data.error).toBe("invalid_period");
  });
});
