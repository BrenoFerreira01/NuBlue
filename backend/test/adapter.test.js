import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createTestContext } from "./helpers.js";

// The adapter must parse values like the production `pg` driver, or tests pass on values production never sees.
let ctx;
before(async () => { ctx = await createTestContext({ seed: false }); });
after(async () => { await ctx.close(); });

test("bigint and numeric come back as strings, like pg", async () => {
  const { rows } = await ctx.pool.query("SELECT count(*) AS c, 12345678901::bigint AS big, 1.50::numeric AS n", []);
  assert.equal(rows[0].c, "1");
  assert.equal(rows[0].big, "12345678901");
  assert.equal(rows[0].n, "1.50");
});

test("dates and timestamps use pg's parsers", async () => {
  const { rows } = await ctx.pool.query("SELECT '2026-11-18'::date AS d, '2026-11-18T10:00:00Z'::timestamptz AS ts", []);
  const pgDate = pg.types.getTypeParser(1082, "text")("2026-11-18");
  assert.equal(rows[0].d.getTime(), pgDate.getTime());
  assert.equal(rows[0].ts.toISOString(), "2026-11-18T10:00:00.000Z");
});

test("pool.query refuses to run inside another caller's open transaction", async () => {
  const client = await ctx.pool.connect();
  await client.query("BEGIN");
  try {
    await assert.rejects(() => ctx.pool.query("SELECT 1", []), /single connection/);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  const { rows } = await ctx.pool.query("SELECT 1 AS one", []);
  assert.equal(rows[0].one, 1);
});
