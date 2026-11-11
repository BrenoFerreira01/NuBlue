import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export function createPool(connectionString = env.appDatabaseUrl()) {
  const pool = new Pool({
    connectionString,
    ssl: env.databaseSsl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "nublue-api",
  });

  pool.on("error", () => {
    process.stderr.write("Unexpected idle PostgreSQL connection error\n");
  });

  return pool;
}

export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
