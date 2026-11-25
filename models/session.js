import database from "infra/database.js";
import { generateToken, hashToken, isToken } from "infra/crypto.js";
import {
  appendSetCookie,
  isProduction,
  parseCookies,
  serializeCookie,
} from "infra/request.js";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias

export function sessionCookieName() {
  // O prefixo __Host- impede que subdomínios sobrescrevam o cookie (exige HTTPS).
  return isProduction() ? "__Host-nublue_session" : "nublue_session";
}

function readToken(req) {
  const token = parseCookies(req)[sessionCookieName()];
  return isToken(token) ? token : null;
}

async function create(res, studentId) {
  const token = generateToken();
  await database.query(
    `INSERT INTO student_sessions (session_hash, student_id, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [hashToken(token), studentId, SESSION_TTL_SECONDS],
  );
  appendSetCookie(
    res,
    serializeCookie(sessionCookieName(), token, {
      maxAge: SESSION_TTL_SECONDS,
    }),
  );
}

/** Aluno da sessão ({ id, nickname, leaderboard_opt_in }) ou null. */
async function findStudent(req) {
  const token = readToken(req);
  if (!token) return null;
  const result = await database.query(
    `SELECT s.id, s.nickname, s.leaderboard_opt_in
     FROM student_sessions ss
     JOIN students s ON s.id = ss.student_id
     WHERE ss.session_hash = $1 AND ss.expires_at > now() AND s.deleted_at IS NULL`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

function clearCookie(res) {
  appendSetCookie(res, serializeCookie(sessionCookieName(), "", { maxAge: 0 }));
}

async function destroy(req, res) {
  const token = readToken(req);
  if (token) {
    await database.query(
      "DELETE FROM student_sessions WHERE session_hash = $1",
      [hashToken(token)],
    );
  }
  clearCookie(res);
}

const session = { create, findStudent, destroy, clearCookie };

export default session;
