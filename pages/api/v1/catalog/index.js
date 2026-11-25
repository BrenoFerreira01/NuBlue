import { createHandler } from "infra/controller.js";
import courseCatalog from "models/catalog.js";

async function getCatalog(req, res) {
  res.status(200).json(await courseCatalog.listPublicLevels());
}

export default createHandler({ GET: getCatalog });
