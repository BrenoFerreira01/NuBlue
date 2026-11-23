import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";

function tooMany() {
  return new ApiError(429, "too_many_attempts", "Muitas tentativas. Aguarde um pouco e tente novamente.");
}

/**
 * In-memory sliding-window limiter. Per process only: with several API
 * instances each one keeps its own counts; use the PostgreSQL limiter there.
 * `hit` throws synchronously; callers may `await` it like the PostgreSQL one.
 */
export function createRateLimiter({ windowMs, max, maxKeys = 10_000, now = Date.now }) {
  const hits = new Map();

  function prune(current) {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((timestamp) => current - timestamp >= windowMs)) hits.delete(key);
    }
    // Still over the cap (many live keys, e.g. a nickname spray): drop the oldest
    // inserted keys so memory stays bounded. Those keys get a fresh window.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    hit(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((timestamp) => current - timestamp < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        throw tooMany();
      }
      recent.push(current);
      hits.set(key, recent);
      if (hits.size > maxKeys) prune(current);
    },
    size: () => hits.size,
  };
}

/**
 * Fixed-window limiter shared by every API instance through PostgreSQL. The window
 * is computed from the database clock so instances with skewed clocks agree. One
 * autocommit statement per hit, so it works through PgBouncer transaction pooling.
 * Expired rows are removed by purgeExpiredData (src/db/maintenance.js).
 */
export function createPostgresRateLimiter(pool, { name, windowMs, max }) {
  return {
    async hit(key) {
      const bucketKey = createHash("sha256").update(`${name}\u0000${key}`).digest("hex");
      const { rows } = await pool.query(
        `WITH w AS (
           SELECT to_timestamp(floor(extract(epoch FROM clock_timestamp()) * 1000 / $2::bigint) * $2::bigint / 1000.0) AS start
         )
         INSERT INTO rate_limit_buckets (bucket_key, window_start, expires_at, hits)
         SELECT $1, w.start, w.start + ($2::bigint * interval '1 millisecond'), 1 FROM w
         ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = rate_limit_buckets.hits + 1
         RETURNING hits`,
        [bucketKey, windowMs],
      );
      if (rows[0].hits > max) throw tooMany();
    },
  };
}

export function createLimiters(store, pool) {
  const make = (name, options) => (store === "postgres"
    ? createPostgresRateLimiter(pool, { name, ...options })
    : createRateLimiter(options));
  return {
    auth: make("auth", { windowMs: 15 * 60_000, max: 8 }),
    // Course and daily-challenge submissions share one bucket per account.
    attempt: make("attempt", { windowMs: 60_000, max: 30 }),
    // Drafts are autosaved with a 300 ms debounce while the student plays.
    draft: make("draft", { windowMs: 60_000, max: 120 }),
  };
}
