import { createHandler } from "infra/controller.js";
import { emailVerificationRequired } from "infra/email.js";
import { limitAuthAttempt } from "infra/rate-limit.js";
import emailVerification from "models/email-verification.js";
import user, {
  emailSchema,
  parseNickname,
  passwordSchema,
  toPublic,
} from "models/user.js";

async function register(req, res) {
  const body = req.body ?? {};
  const { nickname, key } = parseNickname(body.nickname);
  await limitAuthAttempt(req, key);
  const email = emailSchema.parse(body.email);
  const password = passwordSchema.parse(body.password);
  const verificationRequired = emailVerificationRequired();

  // Sem sessão: o aluno entra pelo login. Com a confirmação ligada, só depois
  // de abrir o link do e-mail; desligada, a conta já nasce confirmada.
  const { student, token } = await user.create({
    nickname,
    key,
    email,
    password,
    verified: !verificationRequired,
  });
  if (token) await emailVerification.send(student, email, token);
  res.status(201).json({ student: toPublic(student), verificationRequired });
}

export default createHandler({ POST: register });
