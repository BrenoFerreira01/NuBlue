import { createHandler } from "infra/controller.js";
import { clientAddress } from "infra/request.js";
import { hit, limitAuthAttempt } from "infra/rate-limit.js";
import emailVerification from "models/email-verification.js";
import user, {
  awaitingVerification,
  emailSchema,
  parseNickname,
  passwordSchema,
} from "models/user.js";

/**
 * POST: envia um novo link. Exige a senha; `email` (opcional) corrige um
 * endereço digitado errado enquanto a conta não foi confirmada.
 */
async function resend(req, res) {
  const body = req.body ?? {};
  const { key } = parseNickname(body.nickname);
  await limitAuthAttempt(req, key);
  const password = passwordSchema.parse(body.password);
  const newEmail =
    body.email === undefined ? null : emailSchema.parse(body.email);

  const student = await user.findByCredentials({ key, password });
  if (awaitingVerification(student)) {
    await emailVerification.resend(student, newEmail);
  }
  res.status(200).json({ ok: true });
}

/** PATCH: confirma o e-mail com o token do link. */
async function confirm(req, res) {
  await hit("authAddress", clientAddress(req));
  await emailVerification.consume(req.body?.token);
  res.status(200).json({ verified: true });
}

export default createHandler({ POST: resend, PATCH: confirm });
