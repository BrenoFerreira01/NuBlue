import { randomUUID } from "node:crypto";
import { createStudent, prepare, query, request } from "tests/orchestrator.js";
import {
  answersOf,
  attempt,
  completeLesson,
  levelById,
  newKey,
  wrongAnswersOf,
} from "tests/catalog.js";

const availability = async (cookie) => {
  const response = await request("/api/v1/users/me/availability", { cookie });
  return Object.fromEntries(
    response.data.levels.map((level) => [level.id, level.status]),
  );
};
const xpOf = (levelId, difficulty = "medium") =>
  levelById.get(levelId).variants[difficulty].xpReward;

beforeAll(prepare);

describe("POST /api/v1/attempts", () => {
  it("resposta errada fica registrada sem XP e devolve a resposta certa", async () => {
    const { cookie } = await createStudent();

    const response = await attempt(cookie, 1, {
      answers: wrongAnswersOf(1),
    });

    expect(response.status).toBe(200);
    expect(response.data.correct).toBe(false);
    expect(response.data.correctAnswers).toEqual(answersOf(1));
    expect(response.data.lessonCompleted).toBe(false);
    expect(response.data.xpAwarded).toBe(0);
    expect(response.data.progress.completedLevels).toEqual([]);
  });

  it("resposta certa não revela a chave e não conclui antes da 4ª cruzadinha", async () => {
    const { cookie } = await createStudent();

    const response = await attempt(cookie, 1);

    expect(response.data.correct).toBe(true);
    expect(response.data.correctAnswers).toBeUndefined();
    expect(response.data.lessonCompleted).toBe(false);
    expect(response.data.xpAwarded).toBe(0);
  });

  it("cada versão confere com a própria chave", async () => {
    const { cookie } = await createStudent();

    const easyAnswersOnHard = await attempt(cookie, 1, {
      difficulty: "hard",
      answers: answersOf(1, "easy"),
    });
    const hard = await attempt(cookie, 1, { difficulty: "hard" });

    expect(easyAnswersOnHard.data.correct).toBe(false);
    expect(hard.data.correct).toBe(true);
  });

  it("conclui o nível quando as 4 cruzadinhas da lição estão certas", async () => {
    const { cookie } = await createStudent();

    const last = await completeLesson(cookie, 1, "hard");

    expect(last.data.lessonCompleted).toBe(true);
    expect(last.data.xpAwarded).toBe(xpOf(1, "hard"));
    expect(last.data.progress.completedLevels).toEqual([1]);
  });

  it("errar e acertar de novo a mesma cruzadinha conclui a lição", async () => {
    const { cookie } = await createStudent();
    const lessonId = randomUUID();

    await attempt(cookie, 1, { lessonId, answers: wrongAnswersOf(1) });
    for (const puzzleIndex of [1, 2, 3])
      await attempt(cookie, 1, { lessonId, puzzleIndex });
    const retry = await attempt(cookie, 1, { lessonId, puzzleIndex: 0 });

    expect(retry.data.lessonCompleted).toBe(true);
    expect(retry.data.xpAwarded).toBe(xpOf(1));
  });

  it("cruzadinhas certas de outra lição não contam", async () => {
    const { cookie } = await createStudent();

    for (const puzzleIndex of [0, 1, 2])
      await attempt(cookie, 1, { puzzleIndex });
    const last = await attempt(cookie, 1, { puzzleIndex: 3 });

    expect(last.data.lessonCompleted).toBe(false);
  });

  it("refazer uma lição concluída não dá XP de novo", async () => {
    const { cookie } = await createStudent();

    await completeLesson(cookie, 1);
    const again = await completeLesson(cookie, 1);

    expect(again.data.lessonCompleted).toBe(true);
    expect(again.data.xpAwarded).toBe(0);
    expect(again.data.progress.totalXp).toBe(xpOf(1));
  });

  it("repetir a chave de idempotência devolve o mesmo resultado sem registrar de novo", async () => {
    const { cookie, id } = await createStudent();
    const idempotencyKey = newKey();
    const lessonId = randomUUID();
    const wrong = wrongAnswersOf(1);
    const first = await attempt(cookie, 1, {
      idempotencyKey,
      lessonId,
      answers: wrong,
    });

    const replay = await attempt(cookie, 1, {
      idempotencyKey,
      lessonId,
      answers: wrong,
    });
    expect(replay.status).toBe(200);
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.correct).toBe(first.data.correct);
    expect(replay.data.correctAnswers).toEqual(answersOf(1));
    const [row] = await query(
      "SELECT count(*)::integer AS count FROM level_attempts WHERE student_id = $1",
      [id],
    );
    expect(row.count).toBe(1);

    const changed = await attempt(cookie, 1, {
      idempotencyKey,
      lessonId,
      answers: answersOf(1),
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
    await completeLesson(cookie, 1);
    expect((await attempt(cookie, 2)).data.correct).toBe(true);
  });

  it("recusa dados inválidos", async () => {
    const { cookie } = await createStudent();
    const lessonBody = () => ({
      levelId: 1,
      difficulty: "medium",
      puzzleIndex: 0,
      lessonId: randomUUID(),
      answers: answersOf(1),
      idempotencyKey: newKey(),
    });
    const cases = [
      [
        { levelId: "x", answers: {}, idempotencyKey: newKey() },
        "invalid_level_id",
      ],
      [{ ...lessonBody(), answers: { "l01-i1-01": -1 } }, "invalid_answers"],
      [{ ...lessonBody(), answers: { "l01-i1-01": 1.5 } }, "invalid_answers"],
      [
        { levelId: 1, answers: {}, idempotencyKey: "short" },
        "invalid_idempotency_key",
      ],
      [
        { levelId: 999, answers: {}, idempotencyKey: newKey() },
        "level_not_found",
      ],
      [{ ...lessonBody(), difficulty: "expert" }, "invalid_difficulty"],
      [{ ...lessonBody(), puzzleIndex: 4 }, "invalid_puzzle_index"],
      [{ ...lessonBody(), lessonId: "abc" }, "invalid_lesson_id"],
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

    await completeLesson(cookie, 1);
    const later = await availability(cookie);
    expect(later[1]).toBe("completed");
    expect(later[2]).toBe("available");
    expect(later[3]).toBe("locked");
  });

  it("o progresso de uma conta nunca aparece em outra", async () => {
    const alice = await createStudent();
    const bob = await createStudent();
    await completeLesson(alice.cookie, 1);

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

describe("vidas das lições", () => {
  const livesOf = async (cookie) =>
    (await request("/api/v1/users/me", { cookie })).data.lives;

  it("conta nova começa com 5 vidas, sem cronômetro", async () => {
    const { cookie } = await createStudent();
    expect(await livesOf(cookie)).toEqual({
      lives: 5,
      max: 5,
      nextLifeAt: null,
    });
  });

  it("errar gasta uma vida e liga o cronômetro de 15 minutos", async () => {
    const { cookie } = await createStudent();
    const before = Date.now();

    const wrong = await attempt(cookie, 1, { answers: wrongAnswersOf(1) });

    expect(wrong.data.lives.lives).toBe(4);
    const next = Date.parse(wrong.data.lives.nextLifeAt);
    expect(next - before).toBeGreaterThanOrEqual(15 * 60 * 1000 - 2000);
    expect(next - before).toBeLessThanOrEqual(15 * 60 * 1000 + 5000);
  });

  it("concluir um nível não devolve as vidas", async () => {
    const { cookie } = await createStudent();
    await attempt(cookie, 1, { answers: wrongAnswersOf(1) });

    const done = await completeLesson(cookie, 1);

    expect(done.data.lessonCompleted).toBe(true);
    expect(done.data.lives.lives).toBe(4);
    expect((await livesOf(cookie)).lives).toBe(4);
  });

  it("sem vidas a tentativa é recusada", async () => {
    const { cookie } = await createStudent();
    for (let i = 0; i < 5; i += 1)
      await attempt(cookie, 1, { answers: wrongAnswersOf(1) });

    const blocked = await attempt(cookie, 1);

    expect(blocked.status).toBe(409);
    expect(blocked.data.error).toBe("no_lives");
  });

  it("uma vida volta a cada 15 minutos", async () => {
    const { cookie, id } = await createStudent();
    for (let i = 0; i < 3; i += 1)
      await attempt(cookie, 1, { answers: wrongAnswersOf(1) });
    await query(
      "UPDATE students SET lives_updated_at = now() - interval '16 minutes' WHERE id = $1",
      [id],
    );

    expect((await livesOf(cookie)).lives).toBe(3);
  });
});
