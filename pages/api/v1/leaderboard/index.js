import { createHandler } from "infra/controller.js";
import leaderboard from "models/leaderboard.js";
import session from "models/session.js";

/** Ranking público; quem está logado também recebe a própria posição. */
async function getLeaderboard(req, res) {
  const viewer = await session.findStudent(req);
  res
    .status(200)
    .json(await leaderboard.list(req.query.period ?? "weekly", viewer?.id));
}

export default createHandler({ GET: getLeaderboard });
