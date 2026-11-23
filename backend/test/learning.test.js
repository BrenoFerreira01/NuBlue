import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { catalog, createTestContext } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

const levelById = new Map(catalog.levels.map((level) => [level.id, level]));
let keyCounter = 0;
const newKey = () => `test-key-${process.pid}-${++keyCounter}`;

function attempt(cookie, levelId, { answers = levelById.get(levelId).answerKey, idempotencyKey = newKey() } = {}) {
  return ctx.request("POST", "/api/attempts", { cookie, body: { levelId, answers, idempotencyKey } });
}

test("a wrong answer is recorded without XP or completion", async () => {
  const { cookie } = await ctx.registerStudent();
  const wrong = Object.fromEntries(Object.keys(levelById.get(1).answerKey).map((id) => [id, 0]));
  const response = await attempt(cookie, 1, { answers: wrong });
  assert.equal(response.status, 200);
  assert.equal(response.body.correct, false);
  assert.equal(response.body.xpAwarded, 0);
  assert.deepEqual(response.body.progress.completedLevels, []);
});

test("the client cannot send XP or completion; the server computes them", async () => {
  const { cookie } = await ctx.registerStudent();
  const response = await ctx.request("POST", "/api/attempts", {
    cookie,
    body: { levelId: 1, answers: levelById.get(1).answerKey, idempotencyKey: newKey(), xpAwarded: 9999, correct: true },
  });
  assert.equal(response.body.xpAwarded, levelById.get(1).xpReward);
  assert.equal(response.body.progress.totalXp, levelById.get(1).xpReward);
});

test("XP is granted only on the first correct completion", async () => {
  const { cookie } = await ctx.registerStudent();
  const first = await attempt(cookie, 1);
  assert.equal(first.body.correct, true);
  assert.equal(first.body.xpAwarded, 10);
  const second = await attempt(cookie, 1);
  assert.equal(second.body.correct, true);
  assert.equal(second.body.xpAwarded, 0);
  assert.equal(second.body.progress.totalXp, 10);
  assert.equal(second.body.progress.totalSolved, 1);
});

test("resending the same idempotency key replays the result without double XP", async () => {
  const { cookie } = await ctx.registerStudent();
  const idempotencyKey = newKey();
  const first = await attempt(cookie, 1, { idempotencyKey });
  const replay = await attempt(cookie, 1, { idempotencyKey });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.xpAwarded, first.body.xpAwarded);
  assert.equal(replay.body.progress.totalXp, 10);

  const changed = await attempt(cookie, 1, { idempotencyKey, answers: { "l01-e01": 1, "l01-e02": 1, "l01-e03": 1 } });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error, "idempotency_key_reused");
});

test("levels unlock in sequence within a chapter", async () => {
  const { cookie } = await ctx.registerStudent();
  const locked = await attempt(cookie, 2);
  assert.equal(locked.status, 403);
  assert.equal(locked.body.error, "level_locked");

  const firstOfChapter2 = await attempt(cookie, 4);
  assert.equal(firstOfChapter2.body.correct, true);

  await attempt(cookie, 1);
  const unlocked = await attempt(cookie, 2);
  assert.equal(unlocked.body.correct, true);
});

test("availability follows completions", async () => {
  const { cookie } = await ctx.registerStudent();
  const statusOf = (body) => Object.fromEntries(body.levels.map((level) => [level.id, level.status]));
  const initial = statusOf((await ctx.request("GET", "/api/progress/availability", { cookie })).body);
  assert.equal(initial[1], "available");
  assert.equal(initial[2], "locked");

  await attempt(cookie, 1);
  const later = statusOf((await ctx.request("GET", "/api/progress/availability", { cookie })).body);
  assert.equal(later[1], "completed");
  assert.equal(later[2], "available");
  assert.equal(later[3], "locked");
});

test("one account's progress never shows up in another account", async () => {
  const alice = await ctx.registerStudent();
  const bob = await ctx.registerStudent();
  await attempt(alice.cookie, 1);
  const bobProgress = await ctx.request("GET", "/api/progress", { cookie: bob.cookie });
  assert.deepEqual(bobProgress.body.completedLevels, []);
  assert.equal(bobProgress.body.totalXp, 0);
  const bobAvailability = await ctx.request("GET", "/api/progress/availability", { cookie: bob.cookie });
  assert.equal(bobAvailability.body.levels.find((level) => level.id === 1).status, "available");
});

test("invalid attempt payloads are rejected", async () => {
  const { cookie } = await ctx.registerStudent();
  const cases = [
    [{ levelId: "x", answers: {}, idempotencyKey: newKey() }, "invalid_level_id"],
    [{ levelId: 1, answers: { "l01-e01": -1 }, idempotencyKey: newKey() }, "invalid_answers"],
    [{ levelId: 1, answers: { "l01-e01": 1.5 }, idempotencyKey: newKey() }, "invalid_answers"],
    [{ levelId: 1, answers: {}, idempotencyKey: "short" }, "invalid_idempotency_key"],
    [{ levelId: 999, answers: {}, idempotencyKey: newKey() }, "level_not_found"],
  ];
  for (const [body, error] of cases) {
    const response = await ctx.request("POST", "/api/attempts", { cookie, body });
    assert.equal(response.body.error, error, JSON.stringify(body));
  }
});

test("oversized bodies are rejected", async () => {
  const { cookie } = await ctx.registerStudent();
  const response = await ctx.request("POST", "/api/attempts", { cookie, body: { padding: "x".repeat(70 * 1024) } });
  assert.equal(response.status, 413);
});
