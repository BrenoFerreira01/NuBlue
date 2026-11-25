import pg from "pg";
import { getConnectionConfig } from "../db-config.mjs";

const deadline = Date.now() + 60_000;

process.stdout.write("Aguardando o Postgres");
while (true) {
  const client = new pg.Client(getConnectionConfig());
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    process.stdout.write("\nPostgres pronto.\n");
    break;
  } catch (error) {
    await client.end().catch(() => {});
    if (Date.now() > deadline) {
      process.stdout.write("\n");
      console.error("Postgres não respondeu:", error.message);
      process.exit(1);
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
