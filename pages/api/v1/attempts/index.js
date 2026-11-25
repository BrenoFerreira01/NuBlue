import { createHandler, requireStudent } from "infra/controller.js";
import { hit } from "infra/rate-limit.js";
import { idempotencyKeyFrom, normalizeAnswers } from "models/answers.js";
import attempt, { parseLevelId } from "models/attempt.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

async function submit(req, res) {
  const student = await requireStudent(req);
  // O limite vale mesmo para dados inválidos: validar é barato, mas não grátis.
  await hit("attempt", student.id);
  const levelId = parseLevelId(req.body?.levelId);
  const answers = normalizeAnswers(req.body?.answers);
  const idempotencyKey = idempotencyKeyFrom(req);
  res.status(200).json(
    await attempt.submitCourseAttempt(student, {
      levelId,
      answers,
      idempotencyKey,
    }),
  );
}

export default createHandler({ POST: submit });
