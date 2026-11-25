import { timingSafeEqual } from "node:crypto";
import { createHandler } from "infra/controller.js";
import { UnauthorizedError } from "infra/errors.js";
import maintenance from "models/maintenance.js";

/** A Vercel Cron envia Authorization: Bearer <CRON_SECRET>. */
function assertCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(String(req.headers.authorization || ""));
  const valid =
    Boolean(secret) &&
    expected.length === received.length &&
    timingSafeEqual(expected, received);
  if (!valid)
    throw new UnauthorizedError("invalid_cron_secret", "Não autorizado.");
}

async function runMaintenance(req, res) {
  assertCronSecret(req);
  const removed = await maintenance.purgeExpiredData();
  console.log("[maintenance]", JSON.stringify(removed));
  res.status(200).json({ removed });
}

export default createHandler({ GET: runMaintenance });
