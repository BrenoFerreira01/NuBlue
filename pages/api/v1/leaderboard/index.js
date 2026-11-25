import { createHandler } from "infra/controller.js";
import leaderboard from "models/leaderboard.js";

async function getLeaderboard(req, res) {
  res.status(200).json(await leaderboard.list(req.query.period ?? "weekly"));
}

export default createHandler({ GET: getLeaderboard });
