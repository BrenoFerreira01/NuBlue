import { Pool } from "pg";
import { ServiceError } from "infra/errors.js";
import { getConnectionConfig } from "infra/db-config.mjs";

// Reaproveita o pool entre recarregamentos do Next em desenvolvimento.
const globalForDb = globalThis;

function getPool() {
  if (!globalForDb.__nubluePool) {
    const onVercel = process.env.VERCEL === "1";
    globalForDb.__nubluePool = new Pool({
      ...getConnectionConfig(),
      // Em serverless (Vercel) cada instância deve abrir poucas conexões.
      max: Number(process.env.POSTGRES_POOL_MAX || (onVercel ? 3 : 10)),
      idleTimeoutMillis: onVercel ? 5_000 : 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "nublue",
    });
    globalForDb.__nubluePool.on("error", (error) => {
      console.error("[database] erro inesperado no pool:", error.message);
    });
  }
  return globalForDb.__nubluePool;
}

async function query(text, values) {
  try {
    return await getPool().query(text, values);
  } catch (error) {
    throw wrapError(error);
  }
}

/** Executa callback(client) dentro de BEGIN/COMMIT; ROLLBACK em qualquer erro. */
async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw wrapError(error);
  } finally {
    client.release();
  }
}

// Erros de negócio passam direto; erros do driver viram ServiceError,
// preservando o código do Postgres (ex.: 23505) para tratamento específico.
function wrapError(error) {
  if (error?.statusCode) return error;
  const wrapped = new ServiceError(
    "database_unavailable",
    "Erro na conexão com o banco de dados.",
    { cause: error },
  );
  wrapped.pgCode = error?.code;
  wrapped.constraint = error?.constraint;
  return wrapped;
}

const database = { query, transaction, getPool };

export default database;
