import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { catalog, createTestContext } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

const answerKeyOf = (levelId) => catalog.levels.find((level) => level.id === levelId).answerKey;
let keyCounter = 0;
const newKey = () => `daily-key-${process.pid}-${++keyCounter}`;

test("the daily challenge starts in progress without exposing answers", async () => {
  const { cookie } = await ctx.registerStudent();
  const response = await ctx.request("GET", "/api/daily-challenge", { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "in_progress");
  assert.equal(response.body.date, new Date().toISOString().slice(0, 10));
  assert.equal(response.body.attemptCount, 0);
  assert.ok(response.body.hearts > 0);
  assert.doesNotMatch(response.text, /answer_?key/i);
});

test("drafts persist and reject unknown inputs", async () => {
  const { cookie } = await ctx.registerStudent();
  const { body: challenge } = await ctx.request("GET", "/api/daily-challenge", { cookie });
  const [firstInput] = challenge.level.inputIds;
  const saved = await ctx.request("POST", "/api/daily-challenge/draft", { cookie, body: { answers: { [firstInput]: 7 } } });
  assert.equal(saved.status, 200);
  const reloaded = await ctx.request("GET", "/api/daily-challenge", { cookie });
  assert.deepEqual(reloaded.body.fills, { [firstInput]: 7 });

  const unknown = await ctx.request("POST", "/api/daily-challenge/draft", { cookie, body: { answers: { nope: 1 } } });
  assert.equal(unknown.body.error, "invalid_answers");
});

test("a wrong daily attempt costs a heart; a correct one completes once", async () => {
  const { cookie } = await ctx.registerStudent();
  const { body: challenge } = await ctx.request("GET", "/api/daily-challenge", { cookie });
  const wrongAnswers = Object.fromEntries(challenge.level.inputIds.map((id) => [id, 0]));
  const wrong = await ctx.request("POST", "/api/daily-challenge/attempt", {
    cookie, body: { answers: wrongAnswers, idempotencyKey: newKey() },
  });
  assert.equal(wrong.body.correct, false);
  assert.equal(wrong.body.hearts, challenge.hearts - 1);

  const idempotencyKey = newKey();
  const answers = answerKeyOf(challenge.level.id);
  const correct = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers, idempotencyKey } });
  assert.equal(correct.body.correct, true);
  assert.equal(correct.body.status, "completed");
  assert.equal(correct.body.progress.dailyChallengesCompleted, 1);
  const xp = correct.body.progress.totalXp;
  assert.ok(xp > 0);

  const replay = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers, idempotencyKey } });
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.progress.totalXp, xp);

  const again = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers, idempotencyKey: newKey() } });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "daily_challenge_finished");
});

test("running out of hearts fails the daily challenge", async () => {
  const { cookie } = await ctx.registerStudent();
  const { body: challenge } = await ctx.request("GET", "/api/daily-challenge", { cookie });
  const wrongAnswers = Object.fromEntries(challenge.level.inputIds.map((id) => [id, 0]));
  let last;
  for (let i = 0; i < challenge.hearts; i += 1) {
    last = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers: wrongAnswers, idempotencyKey: newKey() } });
  }
  assert.equal(last.body.status, "failed");
  assert.equal(last.body.hearts, 0);
});

test("the leaderboard lists only opted-in students with XP", async () => {
  const visible = await ctx.registerStudent();
  const hidden = await ctx.registerStudent();
  for (const student of [visible, hidden]) {
    await ctx.request("POST", "/api/attempts", {
      cookie: student.cookie, body: { levelId: 1, answers: answerKeyOf(1), idempotencyKey: newKey() },
    });
  }
  const optIn = await ctx.request("PATCH", "/api/me/leaderboard-visibility", { cookie: visible.cookie, body: { enabled: true } });
  assert.deepEqual(optIn.body, { leaderboardOptIn: true });

  for (const period of ["weekly", "all"]) {
    const board = await ctx.request("GET", `/api/leaderboard?period=${period}`);
    const names = board.body.entries.map((entry) => entry.nickname);
    assert.ok(names.includes(visible.nickname), period);
    assert.ok(!names.includes(hidden.nickname), period);
    assert.deepEqual(Object.keys(board.body.entries[0]).sort(), ["nickname", "streak", "xp"]);
  }
  const invalid = await ctx.request("GET", "/api/leaderboard?period=forever");
  assert.equal(invalid.body.error, "invalid_period");
});
