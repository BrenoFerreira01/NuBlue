import { createHandler, requireStudent } from "infra/controller.js";
import { hit } from "infra/rate-limit.js";
import { idempotencyKeyFrom, normalizeAnswers } from "models/answers.js";
import dailyChallenge from "models/daily-challenge.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

async function submit(req, res) {
  const student = await requireStudent(req);
  // Divide o balde "attempt" com as tentativas do curso.
  await hit("attempt", student.id);
  const answers = normalizeAnswers(req.body?.answers);
  const idempotencyKey = idempotencyKeyFrom(req);
  res
    .status(200)
    .json(await dailyChallenge.submit(student, { answers, idempotencyKey }));
}

export default createHandler({ POST: submit });
