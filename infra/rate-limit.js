import { createHash } from "node:crypto";
import database from "infra/database.js";
import { TooManyRequestsError } from "infra/errors.js";
import { clientAddress } from "infra/request.js";

const LIMITS = {
  auth: { windowMs: 15 * 60_000, max: 8 },
  // Por endereço, somando todos os apelidos: barra spam de cadastro, tentativa de
  // senhas em massa e consumo de CPU do scrypt. Folgado porque uma escola inteira
  // pode sair pelo mesmo IP.
  authAddress: { windowMs: 15 * 60_000, max: 100 },
  // Tentativas do curso e do desafio diário dividem um balde por conta.
  attempt: { windowMs: 60_000, max: 30 },
  // Rascunhos são salvos automaticamente enquanto o aluno joga.
  draft: { windowMs: 60_000, max: 120 },
};

/**
 * Janela fixa compartilhada por todas as instâncias pelo Postgres. A janela usa
 * o relógio do banco, então instâncias com relógios diferentes concordam. Só o
 * hash da chave é guardado. Janelas vencidas são apagadas pela manutenção.
 */
export async function hit(limiterName, key) {
  const { windowMs, max } = LIMITS[limiterName];
  const bucketKey = createHash("sha256")
    .update(`${limiterName}\u0000${key}`)
    .digest("hex");
  const { rows } = await database.query(
    `WITH w AS (
       SELECT to_timestamp(floor(extract(epoch FROM clock_timestamp()) * 1000 / $2::bigint) * $2::bigint / 1000.0) AS start
     )
     INSERT INTO rate_limit_buckets (bucket_key, window_start, expires_at, hits)
     SELECT $1, w.start, w.start + ($2::bigint * interval '1 millisecond'), 1 FROM w
     ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = rate_limit_buckets.hits + 1
     RETURNING hits`,
    [bucketKey, windowMs],
  );
  if (rows[0].hits > max) throw new TooManyRequestsError();
}

/** Limites do login e do cadastro: por endereço e por endereço + apelido. */
export async function limitAuthAttempt(req, nicknameKey) {
  const address = clientAddress(req);
  await hit("authAddress", address);
  await hit("auth", `${address}:auth:${nicknameKey}`);
}
