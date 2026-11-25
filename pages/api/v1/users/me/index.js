import { createHandler, requireStudent } from "infra/controller.js";
import { ValidationError } from "infra/errors.js";
import progress from "models/progress.js";
import session from "models/session.js";
import user, { toPublic } from "models/user.js";

async function getMe(req, res) {
  const student = await requireStudent(req);
  res.status(200).json({
    student: toPublic(student),
    progress: await progress.get(student.id),
  });
}

/** Liga/desliga a participação no ranking. */
async function updateMe(req, res) {
  const student = await requireStudent(req);
  const enabled = req.body?.leaderboardOptIn;
  if (typeof enabled !== "boolean") {
    throw new ValidationError("invalid_visibility");
  }
  res.status(200).json({
    leaderboardOptIn: await user.setLeaderboardOptIn(student.id, enabled),
  });
}

/** Exclui a conta e, em cascata, todos os dados do aluno. */
async function deleteMe(req, res) {
  const student = await requireStudent(req);
  await user.remove(student.id);
  session.clearCookie(res);
  res.status(200).json({ ok: true });
}

export default createHandler({ GET: getMe, PATCH: updateMe, DELETE: deleteMe });
