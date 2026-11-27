import { z } from "zod";
import database from "infra/database.js";
import { hashPassword, verifyPassword } from "infra/crypto.js";
import { ConflictError, UnauthorizedError } from "infra/errors.js";
import emailVerification from "models/email-verification.js";

// As mensagens dos schemas são os codes da API (ver handleError em infra/controller.js).
export const nicknameSchema = z
  .string({ error: "invalid_nickname" })
  .transform((value) => value.normalize("NFKC").trim())
  .refine((value) => /^[\p{L}\p{N}_-]{3,24}$/u.test(value), {
    error: "invalid_nickname",
  });

export const emailSchema = z
  .string({ error: "invalid_email" })
  .trim()
  .toLowerCase()
  .refine(
    (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    { error: "invalid_email" },
  );

export const passwordSchema = z.string({ error: "invalid_password" }).refine(
  (value) => {
    const length = Array.from(value).length;
    return length >= 8 && length <= 128;
  },
  { error: "invalid_password" },
);

/** Apelido normalizado e a chave usada para unicidade (minúsculas). */
export function parseNickname(value) {
  const nickname = nicknameSchema.parse(value);
  return { nickname, key: nickname.toLocaleLowerCase("pt-BR") };
}

export function toPublic(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    leaderboardOptIn: row.leaderboard_opt_in,
    difficulty: row.difficulty,
  };
}

export const DIFFICULTIES = ["easy", "medium", "hard"];

export function isDifficulty(value) {
  return DIFFICULTIES.includes(value);
}

/** Conta criada com e-mail que ainda não foi confirmado. */
export function awaitingVerification(student) {
  return student.email !== null && student.email_verified_at === null;
}

/**
 * Cria a conta (sem sessão) e, se `verified` for falso, o link de confirmação.
 * Retorna { student, token } (token é null quando a conta já nasce confirmada).
 */
async function create({ nickname, key, email, password, verified = false }) {
  const passwordHash = await hashPassword(password);
  try {
    return await database.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO students (nickname, nickname_key, password_hash, email)
         VALUES ($1, $2, $3, $4) RETURNING id, nickname, leaderboard_opt_in, difficulty`,
        [nickname, key, passwordHash, email],
      );
      await client.query(
        "INSERT INTO student_progress (student_id) VALUES ($1)",
        [rows[0].id],
      );
      const token = verified
        ? null
        : await emailVerification.create(client, rows[0].id);
      return { student: rows[0], token };
    });
  } catch (error) {
    if (error.pgCode === "23505") {
      throw new ConflictError("nickname_taken", "Esse apelido já está em uso.");
    }
    throw error;
  }
}

/**
 * Confere apelido e senha. Apelidos inexistentes também pagam um scrypt, para
 * o tempo de resposta não revelar quais apelidos existem.
 */
async function findByCredentials({ key, password }) {
  const { rows } = await database.query(
    `SELECT id, nickname, password_hash, leaderboard_opt_in, difficulty, email, email_verified_at
     FROM students WHERE nickname_key = $1 AND deleted_at IS NULL`,
    [key],
  );
  let valid = false;
  if (rows.length) {
    valid = await verifyPassword(password, rows[0].password_hash);
  } else {
    await hashPassword(password);
  }
  if (!valid) {
    throw new UnauthorizedError(
      "invalid_credentials",
      "Apelido ou senha incorretos.",
    );
  }
  return rows[0];
}

/** Marca o e-mail como confirmado (usado com a confirmação desligada). */
async function markVerified(id) {
  await database.query(
    "UPDATE students SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
    [id],
  );
}

async function remove(id) {
  await database.query("DELETE FROM students WHERE id = $1", [id]);
}

async function setLeaderboardOptIn(id, enabled) {
  const { rows } = await database.query(
    "UPDATE students SET leaderboard_opt_in = $2 WHERE id = $1 RETURNING leaderboard_opt_in",
    [id, enabled],
  );
  return rows[0].leaderboard_opt_in;
}

async function setDifficulty(id, difficulty) {
  const { rows } = await database.query(
    "UPDATE students SET difficulty = $2 WHERE id = $1 RETURNING difficulty",
    [id, difficulty],
  );
  return rows[0].difficulty;
}

const user = {
  create,
  findByCredentials,
  remove,
  setLeaderboardOptIn,
  setDifficulty,
};

export default user;
