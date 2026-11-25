import { readFileSync } from "node:fs";
import { createStudent, prepare, request } from "tests/orchestrator.js";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);
const levelById = new Map(catalog.levels.map((level) => [level.id, level]));
let keyCounter = 0;
const newKey = () => `test-key-${process.pid}-${++keyCounter}`;

function attempt(
  cookie,
  levelId,
  {
    answers = levelById.get(levelId).answerKey,
    idempotencyKey = newKey(),
  } = {},
) {
  return request("/api/v1/attempts", {
    method: "POST",
    cookie,
    body: { levelId, answers, idempotencyKey },
  });
}

const availability = async (cookie) => {
  const response = await request("/api/v1/users/me/availability", { cookie });
  return Object.fromEntries(
    response.data.levels.map((level) => [level.id, level.status]),
  );
};

beforeAll(prepare);

describe("POST /api/v1/attempts", () => {
  it("resposta errada fica registrada sem XP nem conclusão", async () => {
    const { cookie } = await createStudent();
    const wrong = Object.fromEntries(
      Object.keys(levelById.get(1).answerKey).map((id) => [id, 0]),
    );

    const response = await attempt(cookie, 1, { answers: wrong });

    expect(response.status).toBe(200);
    expect(response.data.correct).toBe(false);
    expect(response.data.xpAwarded).toBe(0);
    expect(response.data.progress.completedLevels).toEqual([]);
  });

  it("o servidor calcula XP e conclusão, ignorando o que o cliente manda", async () => {
    const { cookie } = await createStudent();

    const response = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: {
        levelId: 1,
        answers: levelById.get(1).answerKey,
        idempotencyKey: newKey(),
        xpAwarded: 9999,
        correct: true,
      },
    });

    expect(response.data.xpAwarded).toBe(levelById.get(1).xpReward);
    expect(response.data.progress.totalXp).toBe(levelById.get(1).xpReward);
  });

  it("dá XP só na primeira conclusão correta", async () => {
    const { cookie } = await createStudent();

    const first = await attempt(cookie, 1);
    const second = await attempt(cookie, 1);

    expect(first.data.correct).toBe(true);
    expect(first.data.xpAwarded).toBe(10);
    expect(second.data.correct).toBe(true);
    expect(second.data.xpAwarded).toBe(0);
    expect(second.data.progress.totalXp).toBe(10);
    expect(second.data.progress.totalSolved).toBe(1);
  });

  it("repetir a chave de idempotência devolve o mesmo resultado sem XP em dobro", async () => {
    const { cookie } = await createStudent();
    const idempotencyKey = newKey();
    const first = await attempt(cookie, 1, { idempotencyKey });

    const replay = await attempt(cookie, 1, { idempotencyKey });
    expect(replay.status).toBe(200);
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.xpAwarded).toBe(first.data.xpAwarded);
    expect(replay.data.progress.totalXp).toBe(10);

    const changed = await attempt(cookie, 1, {
      idempotencyKey,
      answers: { "l01-e01": 1, "l01-e02": 1, "l01-e03": 1 },
    });
    expect(changed.status).toBe(409);
    expect(changed.data.error).toBe("idempotency_key_reused");
  });

  it("os níveis destravam em sequência dentro do capítulo", async () => {
    const { cookie } = await createStudent();

    const locked = await attempt(cookie, 2);
    expect(locked.status).toBe(403);
    expect(locked.data.error).toBe("level_locked");

    expect((await attempt(cookie, 4)).data.correct).toBe(true);
    await attempt(cookie, 1);
    expect((await attempt(cookie, 2)).data.correct).toBe(true);
  });

  it("recusa dados inválidos", async () => {
    const { cookie } = await createStudent();
    const cases = [
      [
        { levelId: "x", answers: {}, idempotencyKey: newKey() },
        "invalid_level_id",
      ],
      [
        { levelId: 1, answers: { "l01-e01": -1 }, idempotencyKey: newKey() },
        "invalid_answers",
      ],
      [
        { levelId: 1, answers: { "l01-e01": 1.5 }, idempotencyKey: newKey() },
        "invalid_answers",
      ],
      [
        { levelId: 1, answers: {}, idempotencyKey: "short" },
        "invalid_idempotency_key",
      ],
      [
        { levelId: 999, answers: {}, idempotencyKey: newKey() },
        "level_not_found",
      ],
    ];
    for (const [body, error] of cases) {
      const response = await request("/api/v1/attempts", {
        method: "POST",
        cookie,
        body,
      });
      expect(response.data.error).toBe(error);
    }
  });

  it("recusa corpo grande demais", async () => {
    const { cookie } = await createStudent();

    const response = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: { padding: "x".repeat(70 * 1024) },
    });

    expect(response.status).toBe(413);
  });

  it("sem sessão responde 401 sem gastar o limite", async () => {
    for (let i = 0; i < 35; i += 1) {
      const response = await request("/api/v1/attempts", {
        method: "POST",
        body: { levelId: 1, answers: {}, idempotencyKey: newKey() },
      });
      expect(response.status).toBe(401);
    }
  });
});

describe("GET /api/v1/users/me/availability", () => {
  it("acompanha as conclusões", async () => {
    const { cookie } = await createStudent();

    const initial = await availability(cookie);
    expect(initial[1]).toBe("available");
    expect(initial[2]).toBe("locked");

    await attempt(cookie, 1);
    const later = await availability(cookie);
    expect(later[1]).toBe("completed");
    expect(later[2]).toBe("available");
    expect(later[3]).toBe("locked");
  });

  it("o progresso de uma conta nunca aparece em outra", async () => {
    const alice = await createStudent();
    const bob = await createStudent();
    await attempt(alice.cookie, 1);

    const me = await request("/api/v1/users/me", { cookie: bob.cookie });
    expect(me.data.progress.completedLevels).toEqual([]);
    expect(me.data.progress.totalXp).toBe(0);
    expect((await availability(bob.cookie))[1]).toBe("available");
  });

  it("sem sessão responde 401", async () => {
    const response = await request("/api/v1/users/me/availability");
    expect(response.status).toBe(401);
  });
});
