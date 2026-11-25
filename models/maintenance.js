import database from "infra/database.js";

/**
 * Apaga o que só existe até vencer: sessões, janelas de rate limit, links de
 * confirmação e contas cujo e-mail não foi confirmado em 7 dias (liberando o
 * apelido). Pode rodar em várias instâncias ao mesmo tempo.
 */
async function purgeExpiredData() {
  const sessions = await database.query(
    "DELETE FROM student_sessions WHERE expires_at <= now()",
  );
  const buckets = await database.query(
    "DELETE FROM rate_limit_buckets WHERE expires_at <= now()",
  );
  const verifications = await database.query(
    "DELETE FROM email_verifications WHERE expires_at <= now()",
  );
  const unverified = await database.query(
    `DELETE FROM students
     WHERE email IS NOT NULL AND email_verified_at IS NULL
       AND created_at <= now() - interval '7 days'`,
  );
  return {
    sessions: sessions.rowCount,
    rateLimitBuckets: buckets.rowCount,
    emailVerifications: verifications.rowCount,
    unverifiedStudents: unverified.rowCount,
  };
}

const maintenance = { purgeExpiredData };

export default maintenance;
