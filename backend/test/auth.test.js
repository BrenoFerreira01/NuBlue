import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestContext, uniqueNickname } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

test("register creates an unconfirmed account and e-mails a confirmation link, without a session", async () => {
  const nickname = uniqueNickname();
  const email = `${nickname}@Example.com`;
  const response = await ctx.request("POST", "/api/auth/register", { body: { nickname, email, password: "senha-segura-1" } });
  assert.equal(response.status, 201);
  assert.equal(response.body.student.nickname, nickname);
  assert.equal(response.body.verificationRequired, true);
  assert.equal(response.cookie, null);

  const sent = ctx.sentEmails.at(-1);
  assert.equal(sent.to, email.toLowerCase());
  assert.equal(sent.nickname, nickname);
  assert.match(sent.url, /^http:\/\/localhost:5173\/\?verify=[0-9a-f]{64}$/);

  // Only the hash of the token is stored.
  const token = ctx.lastVerificationToken(email.toLowerCase());
  const { rows } = await ctx.pool.query("SELECT token_hash FROM email_verifications", []);
  assert.ok(rows.length > 0 && rows.every((row) => row.token_hash !== token));
});

test("an unconfirmed account cannot log in until the link is used", async () => {
  const nickname = uniqueNickname();
  const email = `${nickname}@example.com`;
  const body = { nickname, password: "senha-segura-1" };
  await ctx.request("POST", "/api/auth/register", { body: { ...body, email } });

  const blocked = await ctx.request("POST", "/api/auth/login", { body });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, "email_not_verified");
  assert.equal(blocked.cookie, null);

  const verified = await ctx.request("POST", "/api/auth/verify-email", { body: { token: ctx.lastVerificationToken(email) } });
  assert.equal(verified.status, 200);
  assert.deepEqual(verified.body, { verified: true });

  const login = await ctx.request("POST", "/api/auth/login", { body });
  assert.equal(login.status, 200);
  const me = await ctx.request("GET", "/api/me", { cookie: login.cookie });
  assert.equal(me.body.student.nickname, nickname);
  assert.deepEqual(me.body.progress.completedLevels, []);
  assert.equal(me.body.progress.totalXp, 0);
});

test("verification tokens are single-use and expire", async () => {
  const nickname = uniqueNickname();
  const email = `${nickname}@example.com`;
  await ctx.request("POST", "/api/auth/register", { body: { nickname, email, password: "senha-segura-1" } });
  const token = ctx.lastVerificationToken(email);

  await ctx.pool.query("UPDATE email_verifications SET expires_at = now() - interval '1 second'", []);
  const expired = await ctx.request("POST", "/api/auth/verify-email", { body: { token } });
  assert.equal(expired.status, 400);
  assert.equal(expired.body.error, "invalid_verification_token");

  for (const bad of ["", "xyz", "f".repeat(64), 42]) {
    const response = await ctx.request("POST", "/api/auth/verify-email", { body: { token: bad } });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_verification_token");
  }
});

test("resending needs the password and replaces the previous link", async () => {
  const nickname = uniqueNickname();
  const email = `${nickname}@example.com`;
  const body = { nickname, password: "senha-segura-1" };
  await ctx.request("POST", "/api/auth/register", { body: { ...body, email } });
  const first = ctx.lastVerificationToken(email);

  const wrong = await ctx.request("POST", "/api/auth/resend-verification", { body: { nickname, password: "senha-errada-9" } });
  assert.equal(wrong.status, 401);
  assert.equal(ctx.lastVerificationToken(email), first);

  const resent = await ctx.request("POST", "/api/auth/resend-verification", { body });
  assert.equal(resent.status, 200);
  const second = ctx.lastVerificationToken(email);
  assert.notEqual(second, first);

  assert.equal((await ctx.request("POST", "/api/auth/verify-email", { body: { token: first } })).status, 400);
  assert.equal((await ctx.request("POST", "/api/auth/verify-email", { body: { token: second } })).status, 200);
  assert.equal((await ctx.request("POST", "/api/auth/verify-email", { body: { token: second } })).status, 400);

  // Already confirmed: nothing new is sent.
  const count = ctx.sentEmails.length;
  assert.equal((await ctx.request("POST", "/api/auth/resend-verification", { body })).status, 200);
  assert.equal(ctx.sentEmails.length, count);
});

test("a mistyped e-mail can be corrected while the account is unconfirmed", async () => {
  const nickname = uniqueNickname();
  const body = { nickname, password: "senha-segura-1" };
  await ctx.request("POST", "/api/auth/register", { body: { ...body, email: "pai@gmial.com" } });
  const typoToken = ctx.lastVerificationToken("pai@gmial.com");

  const invalid = await ctx.request("POST", "/api/auth/resend-verification", { body: { ...body, email: "sem-arroba" } });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "invalid_email");

  const wrongPassword = await ctx.request("POST", "/api/auth/resend-verification", {
    body: { nickname, password: "senha-errada-9", email: "pai@gmail.com" },
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(ctx.lastVerificationToken("pai@gmail.com"), null);

  const fixed = await ctx.request("POST", "/api/auth/resend-verification", { body: { ...body, email: " Pai@Gmail.com " } });
  assert.equal(fixed.status, 200);
  const token = ctx.lastVerificationToken("pai@gmail.com");
  assert.ok(token);
  assert.equal((await ctx.request("POST", "/api/auth/verify-email", { body: { token: typoToken } })).status, 400);
  assert.equal((await ctx.request("POST", "/api/auth/verify-email", { body: { token } })).status, 200);
  const { rows } = await ctx.pool.query("SELECT email FROM students WHERE nickname = $1", [nickname]);
  assert.equal(rows[0].email, "pai@gmail.com");

  // Once confirmed, the e-mail can no longer be changed through this route.
  await ctx.request("POST", "/api/auth/resend-verification", { body: { ...body, email: "outro@example.com" } });
  const after = await ctx.pool.query("SELECT email FROM students WHERE nickname = $1", [nickname]);
  assert.equal(after.rows[0].email, "pai@gmail.com");
});

test("register requires a valid e-mail; several accounts may share one", async () => {
  for (const email of [undefined, "", "sem-arroba", "a@b", `${"x".repeat(250)}@example.com`, 7]) {
    const response = await ctx.request("POST", "/api/auth/register", {
      body: { nickname: uniqueNickname(), email, password: "senha-segura-1" },
    });
    assert.equal(response.status, 400, String(email));
    assert.equal(response.body.error, "invalid_email");
  }
  const shared = "responsavel@example.com";
  for (let i = 0; i < 2; i += 1) {
    const response = await ctx.request("POST", "/api/auth/register", {
      body: { nickname: uniqueNickname(), email: shared, password: "senha-segura-1" },
    });
    assert.equal(response.status, 201);
  }
});

test("accounts created before e-mail existed keep logging in", async () => {
  const { nickname, student } = await ctx.registerStudent();
  await ctx.pool.query("UPDATE students SET email = NULL, email_verified_at = NULL WHERE id = $1", [student.id]);
  const login = await ctx.request("POST", "/api/auth/login", { body: { nickname, password: "senha-segura-1" } });
  assert.equal(login.status, 200);
});

test("nicknames are unique case-insensitively", async () => {
  const nickname = uniqueNickname("Dup");
  await ctx.registerStudent(nickname);
  const response = await ctx.request("POST", "/api/auth/register", {
    body: { nickname: nickname.toLowerCase(), email: "outro@example.com", password: "outra-senha-2" },
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, "nickname_taken");
});

test("register rejects invalid nickname and short password", async () => {
  const badNick = await ctx.request("POST", "/api/auth/register", { body: { nickname: "a b", email: "a@example.com", password: "senha-segura-1" } });
  assert.equal(badNick.body.error, "invalid_nickname");
  const badPassword = await ctx.request("POST", "/api/auth/register", { body: { nickname: uniqueNickname(), email: "a@example.com", password: "curta" } });
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
