import { createHandler, requireStudent } from "infra/controller.js";
import dailyChallenge from "models/daily-challenge.js";

async function getChallenge(req, res) {
  const student = await requireStudent(req);
  res.status(200).json(await dailyChallenge.get(student));
}

export default createHandler({ GET: getChallenge });
