import { createHandler, requireStudent } from "infra/controller.js";
import progress from "models/progress.js";

async function getAvailability(req, res) {
  const student = await requireStudent(req);
  res.status(200).json(await progress.availability(student.id));
}

export default createHandler({ GET: getAvailability });
