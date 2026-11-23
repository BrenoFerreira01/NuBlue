import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { clientAddress } from "../src/app.js";
import { parseOrigins } from "../src/config/env.js";
import { purgeExpiredData } from "../src/db/maintenance.js";
import { listMigrationVersions } from "../src/db/migrations-runner.js";
import { createPostgresRateLimiter, createRateLimiter } from "../src/rate-limit.js";
import { createTestContext, uniqueNickname } from "./helpers.js";

const latestSchema = (await listMigrationVersions()).at(-1);
const pagesOrigin = "https://brenoferreira01.github.io";

let ctx;
before(async () => {
  ctx = await createTestContext({
    server: { frontendOrigins: ["http://localhost:5173", pagesOrigin], rateLimitStore: "postgres" },
  });
});
after(async () => { await ctx.close(); });

test("health reports the applied schema version", async () => {
  const response = await ctx.request("GET", "/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", database: "connected", schemaVersion: latestSchema });
});

test("health fails when the database is behind the code's migrations", async () => {
  const fresh = await createTestContext({ seed: false });
  try {
    await fresh.pool.query("DELETE FROM schema_migrations WHERE version = $1", [latestSchema]);
    const response = await fresh.request("GET", "/api/health");
    assert.equal(response.status, 503);
    assert.equal(response.body.error, "schema_outdated");
    assert.notEqual(response.body.schemaVersion, latestSchema);
  } finally {
    await fresh.close();
  }
});

test("health accepts a schema newer than the code (rolling deploy, rollback)", async () => {
  const fresh = await createTestContext({ seed: false });
  try {
    await fresh.pool.query("INSERT INTO schema_migrations (version) VALUES ('999_future')", []);
    const response = await fresh.request("GET", "/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.schemaVersion, "999_future");
  } finally {
    await fresh.close();
  }
});

test("the PostgreSQL limiter blocks past max per key and stores only hashes", async () => {
  const limiter = createPostgresRateLimiter(ctx.pool, { name: "unit", windowMs: 60_000, max: 3 });
  for (let i = 0; i < 3; i += 1) await limiter.hit("203.0.113.7:auth:aluna");
  await assert.rejects(() => limiter.hit("203.0.113.7:auth:aluna"), (error) => error.status === 429);
  await limiter.hit("203.0.113.7:auth:outra");

  const { rows } = await ctx.pool.query("SELECT bucket_key FROM rate_limit_buckets", []);
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((row) => /^[0-9a-f]{64}$/.test(row.bucket_key)));
});

test("limiters with different names do not share buckets", async () => {
  const a = createPostgresRateLimiter(ctx.pool, { name: "a", windowMs: 60_000, max: 1 });
  const b = createPostgresRateLimiter(ctx.pool, { name: "b", windowMs: 60_000, max: 1 });
  await a.hit("same-key");
  await b.hit("same-key");
  await assert.rejects(() => a.hit("same-key"), (error) => error.status === 429);
});

test("the API rate-limits logins through PostgreSQL", async () => {
  const nickname = uniqueNickname("pglimit");
  const body = { nickname, password: "senha-errada-1" };
  for (let i = 0; i < 8; i += 1) {
    assert.equal((await ctx.request("POST", "/api/auth/login", { body })).status, 401);
  }
  const limited = await ctx.request("POST", "/api/auth/login", { body });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, "too_many_attempts");
});

test("behind a trusted proxy each client address gets its own login bucket", async () => {
  const proxied = await createTestContext({ seed: false, server: { trustProxyHops: 1 } });
  try {
    const body = { nickname: uniqueNickname("proxy"), password: "senha-errada-1" };
    const from = (ip) => ({ body, headers: { "x-forwarded-for": `198.51.100.99, ${ip}` } });
    for (let i = 0; i < 8; i += 1) await proxied.request("POST", "/api/auth/login", from("192.0.2.1"));
    assert.equal((await proxied.request("POST", "/api/auth/login", from("192.0.2.1"))).status, 429);
    assert.equal((await proxied.request("POST", "/api/auth/login", from("192.0.2.2"))).status, 401);
  } finally {
    await proxied.close();
  }
});

test("clientAddress ignores X-Forwarded-For unless proxies are trusted", () => {
  const request = { headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.5" }, socket: { remoteAddress: "10.0.0.1" } };
  assert.equal(clientAddress(request, 0), "10.0.0.1");
  assert.equal(clientAddress(request, 1), "10.0.0.5");
  assert.equal(clientAddress(request, 2), "6.6.6.6");
  assert.equal(clientAddress(request, 3), "10.0.0.1");
});

test("purgeExpiredData removes expired sessions and closed windows only", async () => {
  const expired = await ctx.registerStudent();
  const live = await ctx.registerStudent();
  await ctx.pool.query(
    "UPDATE student_sessions SET expires_at = now() - interval '1 second' WHERE student_id = $1",
    [expired.student.id],
  );
  await ctx.pool.query(
    `INSERT INTO rate_limit_buckets (bucket_key, window_start, expires_at, hits)
     VALUES ('old', now() - interval '2 hours', now() - interval '1 hour', 1)`,
    [],
  );

  const removed = await purgeExpiredData(ctx.pool);
  assert.ok(removed.sessions >= 1);
  assert.ok(removed.rateLimitBuckets >= 1);
  assert.equal((await ctx.request("GET", "/api/me", { cookie: live.cookie })).status, 200);
  const { rows } = await ctx.pool.query("SELECT count(*)::integer AS count FROM rate_limit_buckets WHERE bucket_key = 'old'", []);
  assert.equal(rows[0].count, 0);
});

test("CORS echoes each configured origin and refuses others", async () => {
  for (const origin of ["http://localhost:5173", pagesOrigin]) {
    const response = await fetch(`${ctx.baseUrl}/api/catalog`, { method: "OPTIONS", headers: { origin } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  }
  const refused = await ctx.request("GET", "/api/catalog", { headers: { origin: `${pagesOrigin}.evil.example` } });
  assert.equal(refused.status, 403);
});

test("FRONTEND_ORIGIN parsing normalizes origins and rejects paths", () => {
  assert.deepEqual(parseOrigins(" https://BrenoFerreira01.github.io , http://localhost:5173 "), [
    "https://brenoferreira01.github.io",
    "http://localhost:5173",
  ]);
  assert.throws(() => parseOrigins("https://brenoferreira01.github.io/NuBlue/"), /without path/);
  assert.throws(() => parseOrigins(" , "), /at least one/);
});

test("the memory limiter stays bounded when every key is live", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5, maxKeys: 3, now: () => 1_000 });
  for (let i = 0; i < 50; i += 1) limiter.hit(`spray-${i}`);
  assert.ok(limiter.size() <= 3);
});
