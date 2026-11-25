import {
  PASSWORD,
  createStudent,
  prepare,
  query,
  request,
  uniqueNickname,
} from "tests/orchestrator.js";

const runMaintenance = (headers = {}) =>
  request("/api/v1/cron/maintenance", { headers });
const authorized = () =>
  runMaintenance({ Authorization: `Bearer ${process.env.CRON_SECRET}` });

beforeAll(prepare);

describe("GET /api/v1/cron/maintenance", () => {
  it("exige o CRON_SECRET", async () => {
    expect((await runMaintenance()).status).toBe(401);
    expect(
      (await runMaintenance({ Authorization: "Bearer errado" })).status,
    ).toBe(401);
  });

  it("remove sessões vencidas e janelas de rate limit fechadas", async () => {
    const expired = await createStudent();
    const live = await createStudent();
    await query(
      "UPDATE student_sessions SET expires_at = now() - interval '1 second' WHERE student_id = $1",
      [expired.id],
    );
    await query(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, expires_at, hits)
       VALUES ('old', now() - interval '2 hours', now() - interval '1 hour', 1)`,
    );

    const response = await authorized();

    expect(response.status).toBe(200);
    expect(response.data.removed.sessions).toBeGreaterThanOrEqual(1);
    expect(response.data.removed.rateLimitBuckets).toBeGreaterThanOrEqual(1);
    expect(
      (await request("/api/v1/users/me", { cookie: live.cookie })).status,
    ).toBe(200);
  });

  it("remove contas não confirmadas há 7 dias, liberando o apelido", async () => {
    const stale = uniqueNickname("stale");
    const recent = uniqueNickname("recent");
    for (const nickname of [stale, recent]) {
      await request("/api/v1/auth/register", {
        method: "POST",
        body: {
          nickname,
          email: `${nickname}@example.com`,
          password: PASSWORD,
        },
      });
    }
    const confirmed = await createStudent();
    await query(
      "UPDATE students SET created_at = now() - interval '8 days' WHERE nickname = $1 OR id = $2",
      [stale, confirmed.id],
    );

    const response = await authorized();

    expect(response.data.removed.unverifiedStudents).toBeGreaterThanOrEqual(1);
    const rows = await query(
      "SELECT nickname FROM students WHERE nickname = ANY($1::text[])",
      [[stale, recent, confirmed.nickname]],
    );
    expect(rows.map((row) => row.nickname).sort()).toEqual(
      [confirmed.nickname, recent].sort(),
    );
  });
});
