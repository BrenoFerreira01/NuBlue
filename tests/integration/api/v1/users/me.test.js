import { readFileSync } from "node:fs";
import {
  PASSWORD,
  createStudent,
  prepare,
  query,
  request,
} from "tests/orchestrator.js";

const catalog = JSON.parse(
  readFileSync("infra/data/course-catalog.json", "utf8"),
);

beforeAll(prepare);

describe("PATCH /api/v1/users/me", () => {
  it("liga e desliga a participação no ranking", async () => {
    const { cookie } = await createStudent();

    const on = await request("/api/v1/users/me", {
      method: "PATCH",
      cookie,
      body: { leaderboardOptIn: true },
    });
    expect(on.status).toBe(200);
    expect(on.data).toEqual({ leaderboardOptIn: true });

    const me = await request("/api/v1/users/me", { cookie });
    expect(me.data.student.leaderboardOptIn).toBe(true);
  });

  it("recusa valor que não é booleano", async () => {
    const { cookie } = await createStudent();

    const response = await request("/api/v1/users/me", {
      method: "PATCH",
      cookie,
      body: { leaderboardOptIn: "sim" },
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toBe("invalid_visibility");
  });
});

describe("DELETE /api/v1/users/me", () => {
  it("apaga a conta e todos os dados dela", async () => {
    const { cookie, nickname, id } = await createStudent();
    const solved = await request("/api/v1/attempts", {
      method: "POST",
      cookie,
      body: {
        levelId: 1,
        answers: catalog.levels[0].answerKey,
        idempotencyKey: "delete-test-1",
      },
    });
    expect(solved.data.correct).toBe(true);

    const deleted = await request("/api/v1/users/me", {
      method: "DELETE",
      cookie,
    });

    expect(deleted.status).toBe(200);
    expect(deleted.setCookie).toMatch(/^nublue_session=; .*Max-Age=0/);
    expect((await request("/api/v1/users/me", { cookie })).status).toBe(401);
    for (const table of [
      "students",
      "student_sessions",
      "level_attempts",
      "level_completions",
      "xp_events",
      "student_progress",
    ]) {
      const column = table === "students" ? "id" : "student_id";
      const [row] = await query(
        `SELECT count(*)::integer AS count FROM ${table} WHERE ${column} = $1`,
        [id],
      );
      expect(row.count).toBe(0);
    }
    const login = await request("/api/v1/auth/login", {
      method: "POST",
      body: { nickname, password: PASSWORD },
    });
    expect(login.status).toBe(401);
  });
});
