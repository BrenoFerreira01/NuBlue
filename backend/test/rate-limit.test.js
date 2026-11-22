import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limit.js";
import { createTestContext } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

// Invalid payloads are cheap and still count: the limit runs before validation.
const invalidAttempt = { levelId: 1, answers: {}, idempotencyKey: "x" };

test("course and daily attempts share a per-account limit of 30 per minute", async () => {
  const { cookie } = await ctx.registerStudent();
  for (let i = 0; i < 20; i += 1) {
    const response = await ctx.request("POST", "/api/attempts", { cookie, body: invalidAttempt });
    assert.equal(response.status, 400);
  }
  for (let i = 0; i < 10; i += 1) {
    const response = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers: {}, idempotencyKey: "x" } });
    assert.equal(response.status, 400);
  }
  const limited = await ctx.request("POST", "/api/attempts", { cookie, body: invalidAttempt });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, "too_many_attempts");
  const limitedDaily = await ctx.request("POST", "/api/daily-challenge/attempt", { cookie, body: { answers: {}, idempotencyKey: "x" } });
  assert.equal(limitedDaily.status, 429);

  const other = await ctx.registerStudent();
  const unaffected = await ctx.request("POST", "/api/attempts", { cookie: other.cookie, body: invalidAttempt });
  assert.equal(unaffected.status, 400);
});

test("draft saves have their own, larger limit", async () => {
  const { cookie } = await ctx.registerStudent();
  for (let i = 0; i < 30; i += 1) {
    await ctx.request("POST", "/api/attempts", { cookie, body: invalidAttempt });
  }
  const draft = await ctx.request("POST", "/api/daily-challenge/draft", { cookie, body: { answers: {} } });
  assert.equal(draft.status, 200);

  for (let i = 1; i < 120; i += 1) {
    await ctx.request("POST", "/api/daily-challenge/draft", { cookie, body: { answers: {} } });
  }
  const limited = await ctx.request("POST", "/api/daily-challenge/draft", { cookie, body: { answers: {} } });
  assert.equal(limited.status, 429);
});

test("unauthenticated attempts get 401, not 429, and do not consume a bucket", async () => {
  for (let i = 0; i < 35; i += 1) {
    const response = await ctx.request("POST", "/api/attempts", { body: invalidAttempt });
    assert.equal(response.status, 401);
  }
});

test("the limiter forgets hits outside the window and prunes idle keys", () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, maxKeys: 3, now: () => now });
  limiter.hit("a");
  limiter.hit("a");
  assert.throws(() => limiter.hit("a"), (error) => error.status === 429 && error.code === "too_many_attempts");
  now = 1000;
  limiter.hit("a");

  for (const key of ["b", "c", "d"]) limiter.hit(key);
  now = 5000;
  limiter.hit("e");
  assert.ok(limiter.size() <= 3);
});
