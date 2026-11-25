import { createHandler } from "infra/controller.js";
import session from "models/session.js";

async function logout(req, res) {
  await session.destroy(req, res);
  res.status(200).json({ ok: true });
}

export default createHandler({ POST: logout });
