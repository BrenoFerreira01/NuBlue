import { readFileSync } from "node:fs";
import { createStudent, prepare, request } from "tests/orchestrator.js";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);
const answerKeyOf = (levelId) =>
  catalog.levels.find((level) => level.id === levelId).answerKey;
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
  it("começa em andamento sem expor as respostas", async () => {
    const { cookie } = await createStudent();

    const response = await getChallenge(cookie);

    expect(response.status).toBe(200);
    expect(response.data.status).toBe("in_progress");
    expect(response.data.date).toBe(new Date().toISOString().slice(0, 10));
    expect(response.data.attemptCount).toBe(0);
    expect(response.data.hearts).toBeGreaterThan(0);
    expect(JSON.stringify(response.data)).not.toMatch(/answer_?key/i);
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

  it("errar custa um coração; acertar conclui uma única vez", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    const wrong = await submit(cookie, {
      answers: wrongAnswersFor(challenge),
      idempotencyKey: newKey(),
    });
    expect(wrong.data.correct).toBe(false);
    expect(wrong.data.hearts).toBe(challenge.hearts - 1);

    const idempotencyKey = newKey();
    const answers = answerKeyOf(challenge.level.id);
    const correct = await submit(cookie, { answers, idempotencyKey });
    expect(correct.data.correct).toBe(true);
    expect(correct.data.status).toBe("completed");
    expect(correct.data.progress.dailyChallengesCompleted).toBe(1);
    const xp = correct.data.progress.totalXp;
    expect(xp).toBeGreaterThan(0);

    const replay = await submit(cookie, { answers, idempotencyKey });
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.progress.totalXp).toBe(xp);

    const again = await submit(cookie, { answers, idempotencyKey: newKey() });
    expect(again.status).toBe(409);
    expect(again.data.error).toBe("daily_challenge_finished");
  });

  it("acabar os corações falha o desafio", async () => {
    const { cookie } = await createStudent();
    const { data: challenge } = await getChallenge(cookie);

    let last;
    for (let i = 0; i < challenge.hearts; i += 1) {
      last = await submit(cookie, {
        answers: wrongAnswersFor(challenge),
        idempotencyKey: newKey(),
      });
    }

    expect(last.data.status).toBe("failed");
    expect(last.data.hearts).toBe(0);
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
    for (const student of [visible, hidden]) {
      await request("/api/v1/attempts", {
        method: "POST",
        cookie: student.cookie,
        body: { levelId: 1, answers: answerKeyOf(1), idempotencyKey: newKey() },
      });
    }
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
