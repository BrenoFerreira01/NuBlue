/**
 * Removes rows that only exist until they expire: sessions past expires_at and
 * rate-limit windows that already closed. Safe to run from several instances.
 */
export async function purgeExpiredData(pool) {
  const sessions = await pool.query("DELETE FROM student_sessions WHERE expires_at <= now()", []);
  const buckets = await pool.query("DELETE FROM rate_limit_buckets WHERE expires_at <= now()", []);
  return { sessions: sessions.rowCount, rateLimitBuckets: buckets.rowCount };
}
