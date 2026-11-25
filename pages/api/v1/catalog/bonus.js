import { createHandler, requireStudent } from "infra/controller.js";
import courseCatalog from "models/catalog.js";

async function getBonus(req, res) {
  const student = await requireStudent(req);
  res
    .status(200)
    .json({ level: await courseCatalog.getBonusLevel(student.id) });
}

export default createHandler({ GET: getBonus });
