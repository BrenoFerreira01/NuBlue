import database from "infra/database.js";
import { generateToken, hashToken, isToken } from "infra/crypto.js";
import { sendVerificationEmail } from "infra/email.js";
import { ValidationError } from "infra/errors.js";
import { appUrl } from "infra/request.js";

const VERIFICATION_TTL_SECONDS = 24 * 60 * 60;

/** Substitui o link pendente do aluno por um novo. Só o hash é guardado. */
async function create(client, studentId) {
  const token = generateToken();
  await client.query("DELETE FROM email_verifications WHERE student_id = $1", [
    studentId,
  ]);
  await client.query(
    `INSERT INTO email_verifications (token_hash, student_id, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [hashToken(token), studentId, VERIFICATION_TTL_SECONDS],
  );
  return token;
}

function verificationUrl(token) {
  return `${appUrl()}/verificar-email?token=${token}`;
}

async function send(student, email, token) {
  await sendVerificationEmail({
    to: email,
    nickname: student.nickname,
    url: verificationUrl(token),
  });
}

/** Confirma o e-mail. Apagar a linha consome o link: ele vale uma vez só. */
async function consume(token) {
  const verified =
    isToken(token) &&
    (await database.transaction(async (client) => {
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
    }));
  if (!verified) {
    throw new ValidationError(
      "invalid_verification_token",
      "Este link de confirmação é inválido ou expirou.",
    );
  }
}

/**
 * Gera e envia um novo link para uma conta ainda não confirmada. `newEmail`
 * corrige um endereço digitado errado; contas já confirmadas não mudam.
 */
async function resend(student, newEmail) {
  const email = newEmail ?? student.email;
  const token = await database.transaction(async (client) => {
    if (email !== student.email) {
      await client.query("UPDATE students SET email = $2 WHERE id = $1", [
        student.id,
        email,
      ]);
    }
    return create(client, student.id);
  });
  await send(student, email, token);
}

const emailVerification = { create, send, consume, resend };

export default emailVerification;
