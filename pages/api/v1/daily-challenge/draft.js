import { createHandler, requireStudent } from "infra/controller.js";
import { hit } from "infra/rate-limit.js";
import { normalizeAnswers } from "models/answers.js";
import dailyChallenge from "models/daily-challenge.js";

export const config = { api: { bodyParser: { sizeLimit: "64kb" } } };

async function saveDraft(req, res) {
  const student = await requireStudent(req);
  await hit("draft", student.id);
  await dailyChallenge.saveDraft(student, normalizeAnswers(req.body?.answers));
  res.status(200).json({ saved: true });
}

export default createHandler({ PUT: saveDraft });
