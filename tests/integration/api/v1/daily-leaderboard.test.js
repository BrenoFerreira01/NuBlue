import { createStudent, prepare, query, request } from "tests/orchestrator.js";
import { completeLesson } from "tests/catalog.js";
import { dailyPuzzle } from "lib/game/dailyRun.mjs";
import { DAILY_START_STEP } from "lib/game/tracks.mjs";

// A semente da rodada fica só no servidor; o teste a lê do banco para gerar
// de novo a cruzadinha atual.
async function answersFor(studentId, challenge) {
  const [run] = await query(
    "SELECT seed FROM daily_challenge_runs WHERE student_id = $1 AND challenge_date = $2::date",
    [studentId, challenge.date],
  );
  return dailyPuzzle(
    run.seed,
    challenge.startStep,
    challenge.currentIndex,
    challenge.score,
  ).puzzle.answers;
}
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
  it("começa na dificuldade geral do aluno, com 5 vidas, sem expor respostas nem semente", async () => {
    const { cookie, id } = await createStudent();
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
      hearts: 5,
      score: 0,
      currentIndex: 0,
      startStep: DAILY_START_STEP.hard,
      step: DAILY_START_STEP.hard,
    });
    expect(response.data.level.inputIds.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.data)).not.toMatch(/answer|seed/i);
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);
    expect(response.data.resetsAt).toBe(midnight.toISOString());
  });

  it("sem sessão responde 401", async () => {
    expect((await getChallenge()).status).toBe(401);
  });

  it("guarda o rascunho e recusa entradas desconhecidas", async () => {
    const { cookie, id } = await createStudent();
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
    const { cookie, id } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    const correct = await submit(cookie, {
      answers: await answersFor(id, challenge),
      idempotencyKey: newKey(),
    });

    expect(correct.data).toMatchObject({
      correct: true,
      score: 1,
      hearts: 5,
      status: "in_progress",
      xpAwarded: 5 + challenge.step,
    });
    expect(correct.data.correctAnswers).toBeUndefined();
    expect(correct.data.progress.dailyChallengesCompleted).toBe(1);
    const next = await getChallenge(cookie);
    expect(next.data.currentIndex).toBe(1);
    expect(next.data.level.id).not.toBe(challenge.level.id);
  });

  it("errar gasta uma vida, mostra a resposta certa e segue para a próxima", async () => {
    const { cookie, id } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    const wrong = await submit(cookie, {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    });

    expect(wrong.data).toMatchObject({
      correct: false,
      hearts: 4,
      score: 0,
      xpAwarded: 0,
      correctAnswers: await answersFor(id, challenge),
    });
    expect((await getChallenge(cookie)).data.currentIndex).toBe(1);
  });

  it("continua de onde parou no mesmo dia", async () => {
    const { cookie, id } = await createStudent();
    const { data: first } = await getChallenge(cookie);
    await submit(cookie, {
      answers: wrongAnswersFor(first),
      idempotencyKey: newKey(),
    });

    const again = await getChallenge(cookie);
    const thirdTime = await getChallenge(cookie);
    expect(again.data).toMatchObject({ currentIndex: 1, hearts: 4 });
    expect(thirdTime.data.level).toEqual(again.data.level);
  });

  it("repetir a chave de idempotência não gasta outra vida", async () => {
    const { cookie, id } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);
    const body = {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    };

    await submit(cookie, body);
    const replay = await submit(cookie, body);

    expect(replay.data.replayed).toBe(true);
    expect(replay.data.hearts).toBe(4);
    expect((await getChallenge(cookie)).data.hearts).toBe(4);
  });

  it("o 5º erro encerra o Modo Desafio do dia", async () => {
    const { cookie, id } = await createStudent();
    let challenge = (await getChallenge(cookie)).data;
    await submit(cookie, {
      answers: await answersFor(id, challenge),
      idempotencyKey: newKey(),
    });

    let last;
    for (let i = 0; i < 5; i += 1) {
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
    const { cookie, id } = await createStudent();

    let last;
    for (let i = 0; i < 5; i += 1) {
      const challenge = (await getChallenge(cookie)).data;
      last = await submit(cookie, {
        answers: wrongAnswersFor(challenge),
        idempotencyKey: newKey(),
      });
    }

    expect(last.data).toMatchObject({ status: "failed", score: 0 });
    expect(last.data.progress.currentDailyStreak).toBe(0);
  });

  it("cada conta recebe cruzadinhas sorteadas, com a mesma progressão", async () => {
    const alice = await createStudent();
    const bob = await createStudent();

    const a = (await getChallenge(alice.cookie)).data;
    const b = (await getChallenge(bob.cookie)).data;

    expect(a.step).toBe(b.step);
    expect(a.level.grid).not.toEqual(b.level.grid);
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

describe("posição do aluno no ranking", () => {
  const optIn = (cookie, enabled = true) =>
    request("/api/v1/users/me", {
      method: "PATCH",
      cookie,
      body: { leaderboardOptIn: enabled },
    });

  it("mostra a posição e o XP de quem está logado e aparece no ranking", async () => {
    const student = await createStudent();
    await completeLesson(student.cookie, 1);
    await optIn(student.cookie);

    const board = await request("/api/v1/leaderboard?period=weekly", {
      cookie: student.cookie,
    });

    const index = board.data.entries.findIndex(
      (entry) => entry.nickname === student.nickname,
    );
    expect(board.data.me).toEqual({
      optedIn: true,
      xp: board.data.entries[index].xp,
      rank: index + 1,
    });
  });

  it("quem ainda não tem XP também vê a própria posição", async () => {
    const student = await createStudent();
    await optIn(student.cookie);

    const board = await request("/api/v1/leaderboard?period=all", {
      cookie: student.cookie,
    });

    expect(board.data.me.xp).toBe(0);
    expect(board.data.me.rank).toBe(board.data.entries.length + 1);
  });

  it("quem não aceitou aparecer recebe só o próprio XP", async () => {
    const student = await createStudent();
    await completeLesson(student.cookie, 1);

    const board = await request("/api/v1/leaderboard?period=all", {
      cookie: student.cookie,
    });

    expect(board.data.me).toEqual({ optedIn: false, xp: 15, rank: null });
  });

  it("visitante não recebe posição", async () => {
    const board = await request("/api/v1/leaderboard?period=all");
    expect(board.data.me).toBeUndefined();
  });
});
