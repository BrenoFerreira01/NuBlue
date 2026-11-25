import { createHandler } from "infra/controller.js";
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

  // Sem sessão: a conta só entra depois de confirmar o e-mail.
  const { student, token } = await user.create({
    nickname,
    key,
    email,
    password,
  });
  await emailVerification.send(student, email, token);
  res
    .status(201)
    .json({ student: toPublic(student), verificationRequired: true });
}

export default createHandler({ POST: register });
