import { createStudent, prepare, query, request } from "tests/orchestrator.js";
import { catalog, completeLesson } from "tests/catalog.js";

const place = (cookie, body) =>
  request("/api/v1/placement", { method: "POST", cookie, body });

beforeAll(prepare);

describe("POST /api/v1/placement", () => {
  it("marca os capítulos anteriores como concluídos, sem XP", async () => {
    const { cookie, id } = await createStudent();

    const response = await place(cookie, { chapter: 3, difficulty: "hard" });

    expect(response.status).toBe(200);
    const earlier = catalog.levels
      .filter((level) => level.chapter < 3)
      .map((level) => level.id);
    expect(response.data.progress.completedLevels).toEqual(earlier);
    expect(response.data.progress.totalXp).toBe(0);
    const [xp] = await query(
      "SELECT count(*)::integer AS count FROM xp_events WHERE student_id = $1",
      [id],
    );
    expect(xp.count).toBe(0);
    const me = await request("/api/v1/users/me", { cookie });
    expect(me.data.student.difficulty).toBe("hard");
  });

  it("no capítulo 1 só grava a dificuldade", async () => {
    const { cookie } = await createStudent();

    const response = await place(cookie, { chapter: 1, difficulty: "easy" });

    expect(response.status).toBe(200);
    expect(response.data.progress.completedLevels).toEqual([]);
  });

  it("só pode ser feito uma vez", async () => {
    const { cookie } = await createStudent();
    await place(cookie, { chapter: 2, difficulty: "medium" });

    const again = await place(cookie, { chapter: 5, difficulty: "hard" });

    expect(again.status).toBe(409);
    expect(again.data.error).toBe("placement_already_done");
  });

  it("não vale para quem já concluiu níveis", async () => {
    const { cookie } = await createStudent();
    await completeLesson(cookie, 1);

    const response = await place(cookie, { chapter: 4, difficulty: "hard" });

    expect(response.status).toBe(409);
    expect(response.data.error).toBe("placement_already_done");
  });

  it("recusa capítulo ou dificuldade inválidos", async () => {
    const { cookie } = await createStudent();
    for (const body of [
      { chapter: 0, difficulty: "easy" },
      { chapter: 6, difficulty: "easy" },
      { chapter: "2", difficulty: "easy" },
      { chapter: 2, difficulty: "expert" },
    ]) {
      const response = await place(cookie, body);
      expect(response.status).toBe(400);
      expect(response.data.error).toBe("invalid_placement");
    }
  });

  it("sem sessão responde 401", async () => {
    const response = await place(undefined, { chapter: 2, difficulty: "easy" });
    expect(response.status).toBe(401);
  });
});
