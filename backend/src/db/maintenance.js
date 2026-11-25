/**
 * Removes rows that only exist until they expire: sessions past expires_at, rate-limit
 * windows that already closed, confirmation links past their deadline and accounts
 * whose e-mail was never confirmed within 7 days (which frees their nicknames).
 * Safe to run from several instances.
 */
export async function purgeExpiredData(pool) {
  const sessions = await pool.query("DELETE FROM student_sessions WHERE expires_at <= now()", []);
  const buckets = await pool.query("DELETE FROM rate_limit_buckets WHERE expires_at <= now()", []);
  const verifications = await pool.query("DELETE FROM email_verifications WHERE expires_at <= now()", []);
  const unverified = await pool.query(
    `DELETE FROM students
     WHERE email IS NOT NULL AND email_verified_at IS NULL
       AND created_at <= now() - interval '7 days'`,
    [],
  );
  return {
    sessions: sessions.rowCount,
    rateLimitBuckets: buckets.rowCount,
    emailVerifications: verifications.rowCount,
    unverifiedStudents: unverified.rowCount,
  };
}

export function describePurge(removed) {
  return `removed ${removed.sessions} expired sessions, ${removed.rateLimitBuckets} rate-limit windows, `
    + `${removed.emailVerifications} confirmation links, ${removed.unverifiedStudents} unconfirmed accounts`;
}
