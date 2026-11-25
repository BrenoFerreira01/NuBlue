import { createStudent, prepare, query, request } from "tests/orchestrator.js";

beforeAll(prepare);

describe("GET /api/v1/catalog", () => {
  it("entrega os 39 níveis sem as respostas", async () => {
    const response = await request("/api/v1/catalog");

    expect(response.status).toBe(200);
    expect(response.data.levels).toHaveLength(39);
    expect(response.data.chapters).toHaveLength(5);
    expect(JSON.stringify(response.data)).not.toMatch(/answer_?key/i);
    expect(response.data.levels.every((level) => !("source" in level))).toBe(
      true,
    );
  });
});

describe("nível bônus desativado", () => {
  afterAll(() => query("DELETE FROM course_levels WHERE id = 40"));

  it("a API nunca o oferece, mesmo com tudo concluído", async () => {
    const { cookie, id } = await createStudent();
    await query(
      "INSERT INTO level_completions (student_id, level_id) SELECT $1, id FROM course_levels WHERE is_bonus = false",
      [id],
    );

    const availability = await request("/api/v1/users/me/availability", {
      cookie,
    });
    expect(
      availability.data.levels.every((level) => level.status === "completed"),
    ).toBe(true);
    expect(availability.data.bonusAvailable).toBe(false);

    const bonus = await request("/api/v1/catalog/bonus", { cookie });
    expect(bonus.status).toBe(503);
    expect(bonus.data.error).toBe("bonus_unavailable");

    const attempt = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: {
        levelId: 40,
        answers: { a: 9 },
        idempotencyKey: "bonus-attempt-1",
      },
    });
    expect(attempt.status).toBe(404);

    // Um banco semeado antes de o bônus ser desativado ainda tem a linha 40.
    await query(
      `INSERT INTO course_levels (id, chapter, unit, lesson, public_data, answer_key, is_bonus)
       VALUES (40, 5, 3, 9, '{"id":40,"chapter":5}'::jsonb, '{"a":9}'::jsonb, true)`,
    );
    const stale = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: {
        levelId: 40,
        answers: { a: 9 },
        idempotencyKey: "bonus-attempt-2",
      },
    });
    expect(stale.status).toBe(404);
    expect(stale.data.error).toBe("level_not_found");
    expect((await request("/api/v1/catalog")).data.levels).toHaveLength(39);
  });
});
