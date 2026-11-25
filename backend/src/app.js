import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { withTransaction } from "./db/pool.js";
import { env } from "./config/env.js";
import { ApiError } from "./errors.js";
import { createLimiters } from "./rate-limit.js";
import { listMigrationVersions } from "./db/migrations-runner.js";

const scrypt = promisify(scryptCallback);
const catalogPath = fileURLToPath(new URL("./data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const sessionCookieName = "nublue_session";
const sessionDurationSeconds = env.sessionDays * 24 * 60 * 60;
const verificationDurationSeconds = 24 * 60 * 60;
const maxBodyBytes = 64 * 1024;
const expectedSchemaVersion = (await listMigrationVersions()).at(-1);

function json(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function writeSessionCookie(response, value, maxAge) {
  const attributes = [
    `${sessionCookieName}=${value}`,
    "Path=/api",
    "HttpOnly",
    `SameSite=${env.cookieSameSite}`,
    `Max-Age=${maxAge}`,
  ];
  if (env.cookieSecure) attributes.push("Secure");
  // Cross-site deployments (frontend on GitHub Pages, API elsewhere) send the cookie
  // as a third-party cookie. Partitioned (CHIPS) keeps it working in browsers that
  // block unpartitioned third-party cookies. See DEPLOY.md for Safari.
  if (env.cookieSameSite === "None") attributes.push("Partitioned");
  response.setHeader("set-cookie", attributes.join("; "));
}

function setSessionCookie(response, token) {
  writeSessionCookie(response, token, sessionDurationSeconds);
}

function clearSessionCookie(response) {
  writeSessionCookie(response, "", 0);
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.cookie ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeNickname(value) {
  if (typeof value !== "string") throw new ApiError(400, "invalid_nickname");
  const nickname = value.normalize("NFKC").trim();
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(nickname)) {
    throw new ApiError(400, "invalid_nickname", "Use de 3 a 24 letras, números, _ ou -.");
  }
  return { nickname, key: nickname.toLocaleLowerCase("pt-BR") };
}

function validatePassword(value) {
  if (typeof value !== "string" || Array.from(value).length < 8 || Array.from(value).length > 128) {
    throw new ApiError(400, "invalid_password", "A senha precisa ter entre 8 e 128 caracteres.");
  }
  return value;
}

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "invalid_email", "Informe um e-mail válido.");
  }
  return email;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  if (typeof encoded !== "string") return false;
  const [algorithm, saltHex, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(expectedHex)) {
    return false;
  }
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64, {
    N: 1 << 14,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(expectedHex, "hex");
  return timingSafeEqual(actual, expected);
}

/**
 * Client address for rate limiting. Behind N trusted proxies the real client is the
 * N-th entry from the right of X-Forwarded-For; entries further left are set by the
 * client and cannot be trusted.
 */
export function clientAddress(request, trustProxyHops) {
  if (trustProxyHops > 0) {
    const chain = String(request.headers["x-forwarded-for"] ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (chain.length >= trustProxyHops) return chain[chain.length - trustProxyHops];
  }
  return request.socket.remoteAddress ?? "unknown";
}

async function readJson(request) {
  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (contentLength > maxBodyBytes) throw new ApiError(413, "body_too_large");

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new ApiError(413, "body_too_large");
    chunks.push(chunk);
  }
  if (!bytes) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

function requireObject(value, code = "invalid_payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, code);
  return value;
}

function requireIdempotencyKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new ApiError(400, "invalid_idempotency_key");
  }
  return value;
}

function normalizeAnswers(value) {
  requireObject(value, "invalid_answers");
  const entries = Object.entries(value);
  if (entries.length > 64) throw new ApiError(400, "invalid_answers");
  const answers = {};
  for (const [key, answer] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(key) || !Number.isInteger(answer) || answer < 0 || answer > 100_000) {
      throw new ApiError(400, "invalid_answers");
    }
    answers[key] = answer;
  }
  return answers;
}

function answersMatch(submitted, answerKey) {
  const submittedKeys = Object.keys(submitted).sort();
  const expectedKeys = Object.keys(answerKey).sort();
  return submittedKeys.length === expectedKeys.length &&
    submittedKeys.every((key, index) => key === expectedKeys[index] && submitted[key] === answerKey[key]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function challengeIndex(dateKey) {
  return Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000) % catalog.levels.length;
}

function sessionToken(request) {
  const token = cookieValue(request, sessionCookieName);
  return token && /^[0-9a-f]{64}$/i.test(token) ? token : null;
}

async function authenticate(pool, request) {
  const token = sessionToken(request);
  if (!token) return null;
  const result = await pool.query(
    `SELECT s.id, s.nickname, s.leaderboard_opt_in
     FROM student_sessions ss
     JOIN students s ON s.id = ss.student_id
     WHERE ss.session_hash = $1 AND ss.expires_at > now() AND s.deleted_at IS NULL`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

async function requireStudent(pool, request) {
  const student = await authenticate(pool, request);
  if (!student) throw new ApiError(401, "authentication_required");
  return student;
}

async function createStudentSession(client, studentId) {
  const token = randomBytes(32).toString("hex");
  await client.query(
    `INSERT INTO student_sessions (session_hash, student_id, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [hashToken(token), studentId, sessionDurationSeconds],
  );
  return token;
}

/**
 * Replaces any pending confirmation link of the student with a new one and returns
 * its token. Only the token's hash is stored.
 */
async function createEmailVerification(client, studentId) {
  const token = randomBytes(32).toString("hex");
  await client.query("DELETE FROM email_verifications WHERE student_id = $1", [studentId]);
  await client.query(
    `INSERT INTO email_verifications (token_hash, student_id, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [hashToken(token), studentId, verificationDurationSeconds],
  );
  return token;
}

function verificationUrl(appUrl, token) {
  const url = new URL(appUrl);
  url.searchParams.set("verify", token);
  return url.href;
}

/**
 * Password check shared by login and resend. Unknown nicknames still pay for one
 * scrypt so response time does not reveal which nicknames exist.
 */
async function findStudentByCredentials(pool, body) {
  const { key } = normalizeNickname(body.nickname);
  const password = validatePassword(body.password);
  const result = await pool.query(
    `SELECT id, nickname, password_hash, leaderboard_opt_in, email, email_verified_at
     FROM students WHERE nickname_key = $1 AND deleted_at IS NULL`,
    [key],
  );
  const validPassword = result.rowCount
    ? await verifyPassword(password, result.rows[0].password_hash)
    : (await hashPassword(password), false);
  if (!validPassword) throw new ApiError(401, "invalid_credentials", "Apelido ou senha incorretos.");
  return result.rows[0];
}

function awaitingVerification(student) {
  return student.email !== null && student.email_verified_at === null;
}

async function getProgress(pool, studentId, dateKey = utcDateKey()) {
  const { rows: [row] } = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM xp_events WHERE student_id = $1), 0)::integer AS total_xp,
       COALESCE(p.total_solved, 0)::integer AS total_solved,
       CASE WHEN p.last_active_on >= $2::date - 1 THEN COALESCE(p.streak_days, 0) ELSE 0 END::integer AS streak,
       COALESCE(p.completed_daily_challenges, 0)::integer AS daily_challenges_completed,
       CASE WHEN p.last_daily_challenge_on >= $2::date - 1 THEN COALESCE(p.current_daily_streak, 0) ELSE 0 END::integer AS current_daily_streak,
       COALESCE(p.best_daily_streak, 0)::integer AS best_daily_streak,
       COALESCE((SELECT array_agg(level_id ORDER BY level_id) FROM level_completions WHERE student_id = $1), ARRAY[]::integer[]) AS completed_levels
     FROM students s
     LEFT JOIN student_progress p ON p.student_id = s.id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [studentId, dateKey],
  );
  if (!row) throw new ApiError(404, "student_not_found");
  return {
    totalXp: row.total_xp,
    totalSolved: row.total_solved,
    streak: row.streak,
    dailyChallengesCompleted: row.daily_challenges_completed,
    currentDailyStreak: row.current_daily_streak,
    bestDailyStreak: row.best_daily_streak,
    completedLevels: row.completed_levels,
  };
}

async function getLevelAvailability(pool, studentId) {
  const { rows } = await pool.query(
    `SELECT cl.id, cl.public_data->>'chapter' AS chapter,
            (lc.level_id IS NOT NULL) AS completed
     FROM course_levels cl
     LEFT JOIN level_completions lc
       ON lc.level_id = cl.id AND lc.student_id = $1
     WHERE cl.is_bonus = false
     ORDER BY cl.id`,
    [studentId],
  );

  if (rows.length !== catalog.levels.length) throw new ApiError(503, "course_not_seeded");

  const completedIds = new Set();
  const previousByChapter = new Map();
  const levels = rows.map((row) => {
    const id = Number(row.id);
    const chapter = Number(row.chapter);
    if (!Number.isInteger(id) || !Number.isInteger(chapter) || chapter < 1) {
      throw new ApiError(503, "course_not_seeded");
    }
    if (row.completed) completedIds.add(id);

    const previousId = previousByChapter.get(chapter);
    const status = row.completed
      ? "completed"
      : previousId === undefined || completedIds.has(previousId)
        ? "available"
        : "locked";
    previousByChapter.set(chapter, id);
    return { id, status };
  });

  return {
    levels,
    bonusAvailable: Boolean(catalog.bonus) && completedIds.size === catalog.levels.length,
  };
}

async function getStudentPayload(pool, student) {
  const progress = await getProgress(pool, student.id);
  return {
    student: {
      id: student.id,
      nickname: student.nickname,
      leaderboardOptIn: student.leaderboard_opt_in,
    },
    progress,
  };
}

function updateActivityProgress(client, studentId, dateKey) {
  return client.query(
    `INSERT INTO student_progress (student_id, total_solved, streak_days, last_active_on)
     VALUES ($1, 1, 1, $2::date)
     ON CONFLICT (student_id) DO UPDATE SET
       total_solved = student_progress.total_solved + 1,
       streak_days = CASE
         WHEN student_progress.last_active_on = $2::date THEN student_progress.streak_days
         WHEN student_progress.last_active_on = $2::date - 1 THEN student_progress.streak_days + 1
         ELSE 1
       END,
       last_active_on = $2::date,
       updated_at = now()`,
    [studentId, dateKey],
  );
}

async function getCourseLevel(pool, id) {
  const result = await pool.query(
    "SELECT id, public_data, answer_key, is_bonus FROM course_levels WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

async function assertLevelUnlocked(client, studentId, level) {
  if (level.is_bonus) {
    const result = await client.query(
      `SELECT count(*)::integer AS count
       FROM level_completions lc
       JOIN course_levels cl ON cl.id = lc.level_id
       WHERE lc.student_id = $1 AND cl.is_bonus = false`,
      [studentId],
    );
    if (result.rows[0].count < catalog.levels.length) throw new ApiError(403, "level_locked");
    return;
  }

  const previous = await client.query(
    `SELECT id FROM course_levels
     WHERE chapter = $1 AND is_bonus = false AND id < $2
     ORDER BY id DESC LIMIT 1`,
    [level.public_data.chapter, level.id],
  );
  if (!previous.rowCount) return;

  const completed = await client.query(
    "SELECT 1 FROM level_completions WHERE student_id = $1 AND level_id = $2",
    [studentId, previous.rows[0].id],
  );
  if (!completed.rowCount) throw new ApiError(403, "level_locked");
}

async function handleCourseAttempt(pool, student, body, request) {
  const levelId = Number(body.levelId);
  if (!Number.isInteger(levelId) || levelId < 1) throw new ApiError(400, "invalid_level_id");
  const submitted = normalizeAnswers(body.answers);
  const idempotencyKey = requireIdempotencyKey(body.idempotencyKey ?? request.headers["idempotency-key"]);

  const result = await withTransaction(pool, async (client) => {
    const level = await getCourseLevel(client, levelId);
    if (!level || (level.is_bonus && !catalog.bonus)) throw new ApiError(404, "level_not_found");
    await assertLevelUnlocked(client, student.id, level);

    const existing = await client.query(
      `SELECT level_id, submitted_answers, is_correct, xp_awarded
       FROM level_attempts WHERE student_id = $1 AND idempotency_key = $2`,
      [student.id, idempotencyKey],
    );
    if (existing.rowCount) {
      const attempt = existing.rows[0];
      if (attempt.level_id !== levelId || canonicalJson(attempt.submitted_answers) !== canonicalJson(submitted)) {
        throw new ApiError(409, "idempotency_key_reused");
      }
      return { correct: attempt.is_correct, xpAwarded: attempt.xp_awarded, replayed: true };
    }

    const correct = answersMatch(submitted, level.answer_key);
    const created = await client.query(
      `INSERT INTO level_attempts (student_id, level_id, idempotency_key, submitted_answers, is_correct)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (student_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [student.id, levelId, idempotencyKey, JSON.stringify(submitted), correct],
    );
    if (!created.rowCount) {
      const raced = await client.query(
        `SELECT level_id, submitted_answers, is_correct, xp_awarded
         FROM level_attempts WHERE student_id = $1 AND idempotency_key = $2`,
        [student.id, idempotencyKey],
      );
      const attempt = raced.rows[0];
      if (attempt.level_id !== levelId || canonicalJson(attempt.submitted_answers) !== canonicalJson(submitted)) {
        throw new ApiError(409, "idempotency_key_reused");
      }
      return { correct: attempt.is_correct, xpAwarded: attempt.xp_awarded, replayed: true };
    }

    if (!correct) return { correct: false, xpAwarded: 0, replayed: false };

    const completion = await client.query(
      `INSERT INTO level_completions (student_id, level_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING level_id`,
      [student.id, levelId],
    );
    let xpAwarded = 0;
    if (completion.rowCount) {
      xpAwarded = level.public_data.xpReward;
      await client.query(
        "INSERT INTO xp_events (student_id, source, source_id, amount) VALUES ($1, 'level', $2, $3)",
        [student.id, String(levelId), xpAwarded],
      );
      await client.query("UPDATE level_attempts SET xp_awarded = $1 WHERE id = $2", [xpAwarded, created.rows[0].id]);
      await updateActivityProgress(client, student.id, utcDateKey());
    }
    return { correct: true, xpAwarded, replayed: false };
  });

  return { ...result, progress: await getProgress(pool, student.id) };
}

async function initializeDailyChallenge(pool, studentId, dateKey) {
  const selected = await pool.query(
    `SELECT id, public_data FROM course_levels
     WHERE is_bonus = false ORDER BY id OFFSET $1 LIMIT 1`,
    [challengeIndex(dateKey)],
  );
  const level = selected.rows[0];
  if (!level) throw new ApiError(503, "course_unavailable");
  await pool.query(
    `INSERT INTO daily_challenge_runs (student_id, challenge_date, level_id, status)
     VALUES ($1, $2::date, $3, 'in_progress') ON CONFLICT (student_id, challenge_date) DO NOTHING`,
    [studentId, dateKey, level.id],
  );
  const run = await pool.query(
    `SELECT challenge_date::text, level_id, status, hearts, attempt_count, submitted_answers
     FROM daily_challenge_runs WHERE student_id = $1 AND challenge_date = $2::date`,
    [studentId, dateKey],
  );
  return { level, run: run.rows[0] };
}

async function handleDailyChallenge(pool, student) {
  const dateKey = utcDateKey();
  const { level, run } = await initializeDailyChallenge(pool, student.id, dateKey);
  return {
    date: dateKey,
    status: run.status,
    hearts: run.hearts,
    attemptCount: run.attempt_count,
    fills: run.submitted_answers,
    level: level.public_data,
  };
}

async function handleDailyAttempt(pool, student, body, request) {
  const dateKey = utcDateKey();
  const submitted = normalizeAnswers(body.answers);
  const idempotencyKey = requireIdempotencyKey(body.idempotencyKey ?? request.headers["idempotency-key"]);
  await initializeDailyChallenge(pool, student.id, dateKey);

  const result = await withTransaction(pool, async (client) => {
    const runResult = await client.query(
      `SELECT level_id, status, hearts, attempt_count
       FROM daily_challenge_runs
       WHERE student_id = $1 AND challenge_date = $2::date FOR UPDATE`,
      [student.id, dateKey],
    );
    const run = runResult.rows[0];
    const duplicate = await client.query(
      `SELECT is_correct, xp_awarded, submitted_answers FROM daily_challenge_attempts
       WHERE student_id = $1 AND challenge_date = $2::date AND idempotency_key = $3`,
      [student.id, dateKey, idempotencyKey],
    );
    if (duplicate.rowCount) {
      if (canonicalJson(duplicate.rows[0].submitted_answers) !== canonicalJson(submitted)) {
        throw new ApiError(409, "idempotency_key_reused");
      }
      return {
        correct: duplicate.rows[0].is_correct,
        xpAwarded: duplicate.rows[0].xp_awarded,
        status: run.status,
        hearts: run.hearts,
        replayed: true,
      };
    }
    if (run.status !== "in_progress") throw new ApiError(409, "daily_challenge_finished");

    const level = await getCourseLevel(client, run.level_id);
    const correct = answersMatch(submitted, level.answer_key);
    const xpAwarded = correct ? level.public_data.xpReward : 0;
    await client.query(
      `INSERT INTO daily_challenge_attempts
        (student_id, challenge_date, idempotency_key, submitted_answers, is_correct, xp_awarded)
       VALUES ($1, $2::date, $3, $4::jsonb, $5, $6)`,
      [student.id, dateKey, idempotencyKey, JSON.stringify(submitted), correct, xpAwarded],
    );

    if (correct) {
      await client.query(
        `UPDATE daily_challenge_runs
         SET status = 'completed', completed_at = now(), attempt_count = attempt_count + 1
         WHERE student_id = $1 AND challenge_date = $2::date`,
        [student.id, dateKey],
      );
      await client.query(
        `INSERT INTO xp_events (student_id, source, source_id, amount)
         VALUES ($1, 'daily_challenge', $2, $3) ON CONFLICT DO NOTHING`,
        [student.id, dateKey, xpAwarded],
      );
      await updateActivityProgress(client, student.id, dateKey);
      await client.query(
        `INSERT INTO student_progress
          (student_id, completed_daily_challenges, current_daily_streak, best_daily_streak, last_daily_challenge_on)
         VALUES ($1, 1, 1, 1, $2::date)
         ON CONFLICT (student_id) DO UPDATE SET
          completed_daily_challenges = student_progress.completed_daily_challenges + 1,
          current_daily_streak = CASE
            WHEN student_progress.last_daily_challenge_on = $2::date THEN student_progress.current_daily_streak
            WHEN student_progress.last_daily_challenge_on = $2::date - 1 THEN student_progress.current_daily_streak + 1
            ELSE 1
          END,
          best_daily_streak = GREATEST(
            student_progress.best_daily_streak,
            CASE
              WHEN student_progress.last_daily_challenge_on = $2::date THEN student_progress.current_daily_streak
              WHEN student_progress.last_daily_challenge_on = $2::date - 1 THEN student_progress.current_daily_streak + 1
              ELSE 1
            END
          ),
          last_daily_challenge_on = $2::date,
          updated_at = now()`,
        [student.id, dateKey],
      );
      return { correct: true, xpAwarded, status: "completed", hearts: run.hearts, replayed: false };
    }

    const hearts = Math.max(0, run.hearts - 1);
    const status = hearts === 0 ? "failed" : "in_progress";
    await client.query(
      `UPDATE daily_challenge_runs
       SET status = $3, hearts = $4, attempt_count = attempt_count + 1,
           submitted_answers = $5::jsonb
       WHERE student_id = $1 AND challenge_date = $2::date`,
      [student.id, dateKey, status, hearts, JSON.stringify(submitted)],
    );
    if (status === "failed") {
      await client.query(
        `INSERT INTO student_progress (student_id, current_daily_streak, last_daily_challenge_on)
         VALUES ($1, 0, $2::date)
         ON CONFLICT (student_id) DO UPDATE SET
          current_daily_streak = 0, last_daily_challenge_on = $2::date, updated_at = now()`,
        [student.id, dateKey],
      );
    }
    return { correct: false, xpAwarded: 0, status, hearts, replayed: false };
  });

  return { ...result, progress: await getProgress(pool, student.id) };
}

function addCorsHeaders(request, response, allowedOrigins) {
  response.setHeader("vary", "Origin");
  const origin = request.headers.origin;
  if (!origin) return;
  if (!allowedOrigins.includes(origin)) throw new ApiError(403, "origin_not_allowed");
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-credentials", "true");
  response.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type, idempotency-key");
  response.setHeader("access-control-max-age", "600");
}

async function checkHealth(pool) {
  let applied;
  try {
    const result = await pool.query("SELECT max(version) AS version FROM schema_migrations", []);
    applied = result.rows[0]?.version ?? null;
  } catch (error) {
    // 42P01: schema_migrations does not exist yet (migrations never ran).
    if (error?.code === "42P01") applied = null;
    else return { status: 503, body: { status: "error", database: "unavailable" } };
  }
  // Newer schemas are fine: migrations are additive, and during a deploy the release
  // step migrates before old instances are replaced. Versions are zero-padded, so
  // string order is migration order.
  if (applied === null || applied < expectedSchemaVersion) {
    return {
      status: 503,
      body: { status: "error", database: "connected", error: "schema_outdated", schemaVersion: applied },
    };
  }
  return { status: 200, body: { status: "ok", database: "connected", schemaVersion: applied } };
}

/**
 * Options default to the environment; tests override them per server.
 * - frontendOrigins: origins allowed by CORS.
 * - rateLimitStore: "memory" (one process) or "postgres" (shared by instances).
 * - trustProxyHops: reverse proxies that append to X-Forwarded-For.
 */
export function createApiServer(pool, {
  frontendOrigins = env.frontendOrigins,
  rateLimitStore = env.rateLimitStore,
  trustProxyHops = env.trustProxyHops,
  mailer,
  appUrl = env.appUrl,
} = {}) {
  if (!mailer) throw new Error("createApiServer needs a mailer (see src/email.js)");
  const limiters = createLimiters(rateLimitStore, pool);
  const limitAuthAttempts = async (request, nicknameKey) => {
    const address = clientAddress(request, trustProxyHops);
    await limiters.authAddress.hit(address);
    await limiters.auth.hit(`${address}:auth:${nicknameKey}`);
  };
  // The account already exists when this runs: a failed delivery is logged, and the
  // student can ask for a new link from the login screen.
  const sendVerification = async (student, email, token) => {
    try {
      await mailer.sendVerificationEmail({ to: email, nickname: student.nickname, url: verificationUrl(appUrl, token) });
    } catch {
      process.stderr.write("Confirmation e-mail could not be sent\n");
    }
  };

  return createServer(async (request, response) => {
    try {
      addCorsHeaders(request, response, frontendOrigins);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");
      const path = url.pathname;

      if (request.method === "GET" && path === "/api/health") {
        const health = await checkHealth(pool);
        json(response, health.status, health.body);
        return;
      }

      if (request.method === "GET" && path === "/api/catalog") {
        const result = await pool.query(
          "SELECT public_data FROM course_levels WHERE is_bonus = false ORDER BY id",
        );
        if (result.rowCount !== catalog.levels.length) throw new ApiError(503, "course_not_seeded");
        json(response, 200, { chapters: catalog.chapters, levels: result.rows.map((row) => row.public_data) });
        return;
      }

      if (request.method === "GET" && path === "/api/catalog/bonus/very-hard") {
        const student = await requireStudent(pool, request);
        if (!catalog.bonus) throw new ApiError(503, "bonus_unavailable");
        const completed = await pool.query(
          `SELECT count(*)::integer AS count
           FROM level_completions lc
           JOIN course_levels cl ON cl.id = lc.level_id
           WHERE lc.student_id = $1 AND cl.is_bonus = false`,
          [student.id],
        );
        if (completed.rows[0].count < catalog.levels.length) throw new ApiError(403, "level_locked");
        const result = await pool.query(
          "SELECT public_data FROM course_levels WHERE is_bonus = true ORDER BY id LIMIT 1",
        );
        if (!result.rowCount) throw new ApiError(503, "bonus_unavailable");
        json(response, 200, { level: result.rows[0].public_data });
        return;
      }

      if (request.method === "POST" && path === "/api/auth/register") {
        const body = requireObject(await readJson(request));
        const { nickname, key } = normalizeNickname(body.nickname);
        await limitAuthAttempts(request, key);
        const email = normalizeEmail(body.email);
        const passwordHash = await hashPassword(validatePassword(body.password));
        // No session yet: the account is usable only after the e-mail is confirmed.
        const registered = await withTransaction(pool, async (client) => {
          const student = await client.query(
            `INSERT INTO students (nickname, nickname_key, password_hash, email)
             VALUES ($1, $2, $3, $4) RETURNING id, nickname, leaderboard_opt_in`,
            [nickname, key, passwordHash, email],
          );
          await client.query("INSERT INTO student_progress (student_id) VALUES ($1)", [student.rows[0].id]);
          const token = await createEmailVerification(client, student.rows[0].id);
          return { student: student.rows[0], token };
        }).catch((error) => {
          if (error.code === "23505") throw new ApiError(409, "nickname_taken", "Esse apelido já está em uso.");
          throw error;
        });
        await sendVerification(registered.student, email, registered.token);
        json(response, 201, { student: registered.student, verificationRequired: true });
        return;
      }

      if (request.method === "POST" && path === "/api/auth/login") {
        const body = requireObject(await readJson(request));
        await limitAuthAttempts(request, normalizeNickname(body.nickname).key);
        const student = await findStudentByCredentials(pool, body);
        if (awaitingVerification(student)) {
          throw new ApiError(403, "email_not_verified", "Confirme seu e-mail para entrar. Enviamos um link para você.");
        }
        const token = await withTransaction(pool, (client) => createStudentSession(client, student.id));
        setSessionCookie(response, token);
        json(response, 200, {
          student: {
            id: student.id,
            nickname: student.nickname,
            leaderboardOptIn: student.leaderboard_opt_in,
          },
        });
        return;
      }

      if (request.method === "POST" && path === "/api/auth/resend-verification") {
        const body = requireObject(await readJson(request));
        await limitAuthAttempts(request, normalizeNickname(body.nickname).key);
        // Optional `email` corrects a mistyped address. The password proves ownership,
        // and only unconfirmed accounts can change it.
        const newEmail = body.email === undefined ? null : normalizeEmail(body.email);
        const student = await findStudentByCredentials(pool, body);
        if (awaitingVerification(student)) {
          const email = newEmail ?? student.email;
          const token = await withTransaction(pool, async (client) => {
            if (email !== student.email) {
              await client.query("UPDATE students SET email = $2 WHERE id = $1", [student.id, email]);
            }
            return createEmailVerification(client, student.id);
          });
          await sendVerification(student, email, token);
        }
        json(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && path === "/api/auth/verify-email") {
        const body = requireObject(await readJson(request));
        await limiters.authAddress.hit(clientAddress(request, trustProxyHops));
        const token = typeof body.token === "string" && /^[0-9a-f]{64}$/i.test(body.token) ? body.token : null;
        // Deleting the row consumes the link, so it works only once.
        const verified = token && await withTransaction(pool, async (client) => {
          const used = await client.query(
            `DELETE FROM email_verifications
             WHERE token_hash = $1 AND expires_at > now() RETURNING student_id`,
            [hashToken(token)],
          );
          if (!used.rowCount) return false;
          await client.query(
            "UPDATE students SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
            [used.rows[0].student_id],
          );
          return true;
        });
        if (!verified) {
          throw new ApiError(400, "invalid_verification_token", "Este link de confirmação é inválido ou expirou.");
        }
        json(response, 200, { verified: true });
        return;
      }

      if (request.method === "POST" && path === "/api/auth/logout") {
        const token = sessionToken(request);
        if (token) await pool.query("DELETE FROM student_sessions WHERE session_hash = $1", [hashToken(token)]);
        clearSessionCookie(response);
        json(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && (path === "/api/me" || path === "/api/progress" || path === "/api/profile")) {
        const student = await requireStudent(pool, request);
        const payload = await getStudentPayload(pool, student);
        json(response, 200, path === "/api/progress" ? payload.progress : payload);
        return;
      }

      if (request.method === "GET" && path === "/api/progress/availability") {
        const student = await requireStudent(pool, request);
        json(response, 200, await getLevelAvailability(pool, student.id));
        return;
      }

      if (request.method === "DELETE" && path === "/api/me") {
        const student = await requireStudent(pool, request);
        await pool.query("DELETE FROM students WHERE id = $1", [student.id]);
        clearSessionCookie(response);
        json(response, 200, { ok: true });
        return;
      }

      if (request.method === "PATCH" && path === "/api/me/leaderboard-visibility") {
        const student = await requireStudent(pool, request);
        const body = requireObject(await readJson(request));
        if (typeof body.enabled !== "boolean") throw new ApiError(400, "invalid_visibility");
        const updated = await pool.query(
          `UPDATE students SET leaderboard_opt_in = $2
           WHERE id = $1 RETURNING leaderboard_opt_in`,
          [student.id, body.enabled],
        );
        json(response, 200, { leaderboardOptIn: updated.rows[0].leaderboard_opt_in });
        return;
      }

      if (request.method === "POST" && path === "/api/attempts") {
        const student = await requireStudent(pool, request);
        await limiters.attempt.hit(student.id);
        const body = requireObject(await readJson(request));
        json(response, 200, await handleCourseAttempt(pool, student, body, request));
        return;
      }

      if (request.method === "GET" && path === "/api/daily-challenge") {
        const student = await requireStudent(pool, request);
        json(response, 200, await handleDailyChallenge(pool, student));
        return;
      }

      if (request.method === "POST" && path === "/api/daily-challenge/draft") {
        const student = await requireStudent(pool, request);
        await limiters.draft.hit(student.id);
        const body = requireObject(await readJson(request));
        const answers = normalizeAnswers(body.answers);
        const dateKey = utcDateKey();
        const { level, run } = await initializeDailyChallenge(pool, student.id, dateKey);
        if (run.status !== "in_progress") throw new ApiError(409, "daily_challenge_finished");
        const validInputIds = new Set(level.public_data.inputIds);
        if (Object.keys(answers).some((id) => !validInputIds.has(id))) {
          throw new ApiError(400, "invalid_answers");
        }
        await pool.query(
          `UPDATE daily_challenge_runs SET submitted_answers = $3::jsonb
           WHERE student_id = $1 AND challenge_date = $2::date AND status = 'in_progress'`,
          [student.id, dateKey, JSON.stringify(answers)],
        );
        json(response, 200, { saved: true });
        return;
      }

      if (request.method === "POST" && path === "/api/daily-challenge/attempt") {
        const student = await requireStudent(pool, request);
        await limiters.attempt.hit(student.id);
        const body = requireObject(await readJson(request));
        json(response, 200, await handleDailyAttempt(pool, student, body, request));
        return;
      }

      if (request.method === "GET" && path === "/api/leaderboard") {
        const period = url.searchParams.get("period") ?? "weekly";
        if (period !== "weekly" && period !== "all") throw new ApiError(400, "invalid_period");
        const scoreExpression = period === "weekly"
          ? "COALESCE(SUM(e.amount) FILTER (WHERE e.created_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0)"
          : "COALESCE(SUM(e.amount), 0)";
        const result = await pool.query(
          `SELECT s.nickname, ${scoreExpression}::integer AS xp,
                  CASE
                    WHEN p.last_active_on >= (now() AT TIME ZONE 'UTC')::date - 1
                    THEN COALESCE(p.streak_days, 0)
                    ELSE 0
                  END::integer AS streak
           FROM students s
           LEFT JOIN xp_events e ON e.student_id = s.id
           LEFT JOIN student_progress p ON p.student_id = s.id
           WHERE s.leaderboard_opt_in = true AND s.deleted_at IS NULL
           GROUP BY s.id, s.nickname, s.nickname_key, p.streak_days, p.last_active_on
           HAVING ${scoreExpression} > 0
           ORDER BY xp DESC, s.nickname_key ASC
           LIMIT 50`,
          [],
        );
        json(response, 200, { period, entries: result.rows });
        return;
      }

      json(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof ApiError) {
        json(response, error.status, { error: error.code, message: error.message });
        return;
      }
      process.stderr.write("API request failed\n");
      json(response, 500, { error: "internal_error" });
    }
  });
}
