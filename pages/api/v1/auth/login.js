import { createHandler } from "infra/controller.js";
import { emailVerificationRequired } from "infra/email.js";
import { ForbiddenError } from "infra/errors.js";
import { limitAuthAttempt } from "infra/rate-limit.js";
import session from "models/session.js";
import user, {
  awaitingVerification,
  parseNickname,
  passwordSchema,
  toPublic,
} from "models/user.js";

async function login(req, res) {
  const body = req.body ?? {};
  const { key } = parseNickname(body.nickname);
  await limitAuthAttempt(req, key);
  const password = passwordSchema.parse(body.password);

  const student = await user.findByCredentials({ key, password });
  if (awaitingVerification(student) && !emailVerificationRequired()) {
    // Confirmação desligada: contas que ficaram pendentes passam a valer (e
    // deixam de ser apagadas pela limpeza de contas não confirmadas).
    await user.markVerified(student.id);
  } else if (awaitingVerification(student)) {
    throw new ForbiddenError(
      "email_not_verified",
      "Confirme seu e-mail para entrar. Enviamos um link para você.",
    );
  }
  await session.create(res, student.id);
  res.status(200).json({ student: toPublic(student) });
}

export default createHandler({ POST: login });
