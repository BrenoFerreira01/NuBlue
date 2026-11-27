import { createHandler, requireStudent } from "infra/controller.js";
import placement, { parsePlacement } from "models/placement.js";

/** Aplica o resultado do teste de nivelamento (uma vez por conta). */
async function submit(req, res) {
  const student = await requireStudent(req);
  const result = parsePlacement(req.body);
  res.status(200).json(await placement.apply(student, result));
}

export default createHandler({ POST: submit });
