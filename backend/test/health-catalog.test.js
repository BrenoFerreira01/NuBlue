import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createTestContext } from "./helpers.js";

let ctx;
before(async () => { ctx = await createTestContext(); });
after(async () => { await ctx.close(); });

test("GET /api/health reports a connected database", async () => {
  const response = await ctx.request("GET", "/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", database: "connected" });
});

test("GET /api/catalog serves the 39 levels without answer keys", async () => {
  const response = await ctx.request("GET", "/api/catalog");
  assert.equal(response.status, 200);
  assert.equal(response.body.levels.length, 39);
  assert.equal(response.body.chapters.length, 5);
  assert.doesNotMatch(response.text, /answer_?key/i);
  assert.ok(response.body.levels.every((level) => !("source" in level)));
});
