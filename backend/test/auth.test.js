import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestContext, uniqueNickname } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

test("register creates an account, an HTTP-only session and empty progress", async () => {
  const nickname = uniqueNickname();
  const response = await ctx.request("POST", "/api/auth/register", { body: { nickname, password: "senha-segura-1" } });
  assert.equal(response.status, 201);
  assert.equal(response.body.student.nickname, nickname);
  assert.match(response.cookie, /^nublue_session=[0-9a-f]{64}$/);

  const me = await ctx.request("GET", "/api/me", { cookie: response.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.student.nickname, nickname);
  assert.equal(me.body.student.leaderboardOptIn, false);
  assert.deepEqual(me.body.progress.completedLevels, []);
  assert.equal(me.body.progress.totalXp, 0);
});

test("nicknames are unique case-insensitively", async () => {
  const nickname = uniqueNickname("Dup");
  await ctx.registerStudent(nickname);
  const response = await ctx.request("POST", "/api/auth/register", {
    body: { nickname: nickname.toLowerCase(), password: "outra-senha-2" },
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, "nickname_taken");
});

test("register rejects invalid nickname and short password", async () => {
  const badNick = await ctx.request("POST", "/api/auth/register", { body: { nickname: "a b", password: "senha-segura-1" } });
  assert.equal(badNick.body.error, "invalid_nickname");
  const badPassword = await ctx.request("POST", "/api/auth/register", { body: { nickname: uniqueNickname(), password: "curta" } });
  assert.equal(badPassword.body.error, "invalid_password");
});

test("login accepts the right password and rejects a wrong one", async () => {
  const { nickname } = await ctx.registerStudent();
  const ok = await ctx.request("POST", "/api/auth/login", { body: { nickname, password: "senha-segura-1" } });
  assert.equal(ok.status, 200);
  assert.match(ok.cookie, /^nublue_session=/);

  const wrong = await ctx.request("POST", "/api/auth/login", { body: { nickname, password: "senha-errada-9" } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, "invalid_credentials");
  assert.equal(wrong.cookie, null);
});

test("protected routes return 401 without a session or with an unknown token", async () => {
  for (const path of ["/api/me", "/api/progress", "/api/progress/availability", "/api/daily-challenge"]) {
    const anonymous = await ctx.request("GET", path);
    assert.equal(anonymous.status, 401, path);
    assert.equal(anonymous.body.error, "authentication_required");
  }
  const forged = await ctx.request("GET", "/api/me", { cookie: `nublue_session=${"f".repeat(64)}` });
  assert.equal(forged.status, 401);
});

test("expired sessions are rejected", async () => {
  const { cookie } = await ctx.registerStudent();
  await ctx.pool.query("UPDATE student_sessions SET expires_at = now() - interval '1 second'", []);
  const response = await ctx.request("GET", "/api/me", { cookie });
  assert.equal(response.status, 401);
});

test("logout invalidates the session server-side", async () => {
  const { cookie } = await ctx.registerStudent();
  const logout = await ctx.request("POST", "/api/auth/logout", { cookie });
  assert.equal(logout.status, 200);
  assert.equal((await ctx.request("GET", "/api/me", { cookie })).status, 401);
});

test("DELETE /api/me removes the account and its data", async () => {
  const { cookie, nickname, student } = await ctx.registerStudent();
  const level1 = { levelId: 1, answers: { "l01-e01": 3, "l01-e02": 3, "l01-e03": 5 }, idempotencyKey: "delete-test-1" };
  assert.equal((await ctx.request("POST", "/api/attempts", { cookie, body: level1 })).body.correct, true);

  const deleted = await ctx.request("DELETE", "/api/me", { cookie });
  assert.equal(deleted.status, 200);
  assert.match(deleted.cookie, /^nublue_session=$/);
  assert.equal((await ctx.request("GET", "/api/me", { cookie })).status, 401);

  for (const table of ["students", "student_sessions", "level_attempts", "level_completions", "xp_events", "student_progress"]) {
    const column = table === "students" ? "id" : "student_id";
    const { rows } = await ctx.pool.query(`SELECT count(*)::integer AS count FROM ${table} WHERE ${column} = $1`, [student.id]);
    assert.equal(rows[0].count, 0, table);
  }
  const login = await ctx.request("POST", "/api/auth/login", { body: { nickname, password: "senha-segura-1" } });
  assert.equal(login.status, 401);
});

test("requests from a foreign origin are refused", async () => {
  const response = await ctx.request("GET", "/api/catalog", { headers: { origin: "https://evil.example" } });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, "origin_not_allowed");
});
