import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { query } from "tests/orchestrator.js";

const LEGACY_DIR = "infra/legacy-sql";

function run(script, args = []) {
  return execFileSync(process.execPath, [script, ...args], {
    env: process.env,
    encoding: "utf8",
  });
}

async function resetSchema() {
  await query("DROP SCHEMA public CASCADE");
  await query("CREATE SCHEMA public");
}

async function tableExists(name) {
  const [row] = await query("SELECT to_regclass($1) AS name", [name]);
  return row.name !== null;
}

describe("infra/scripts/migrate.mjs", () => {
  afterAll(() => {
    // Deixa o banco pronto para os outros testes.
    run("infra/scripts/migrate.mjs", ["up"]);
    run("infra/scripts/seed.mjs");
  });

  it("aplica o esquema num banco vazio", async () => {
    await resetSchema();

    run("infra/scripts/migrate.mjs", ["up"]);

    expect(await tableExists("students")).toBe(true);
    expect(await tableExists("email_verifications")).toBe(true);
    expect(await tableExists("rate_limit_buckets")).toBe(true);
    const versions = await query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    expect(versions.map((row) => row.version)).toEqual([
      "001_initial_schema",
      "002_rate_limit_buckets",
      "003_email_verification",
    ]);
  });

  it("não reaplica o SQL num banco criado pelo backend antigo", async () => {
    await resetSchema();
    await query(
      "CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of readdirSync(LEGACY_DIR).sort()) {
      await query(readFileSync(`${LEGACY_DIR}/${file}`, "utf8"));
      await query("INSERT INTO schema_migrations (version) VALUES ($1)", [
        file.replace(/\.sql$/, ""),
      ]);
    }
    await query(
      "INSERT INTO students (nickname, nickname_key, password_hash) VALUES ('Antigo', 'antigo', 'x')",
    );

    run("infra/scripts/migrate.mjs", ["up"]);

    const [student] = await query(
      "SELECT nickname FROM students WHERE nickname_key = 'antigo'",
    );
    expect(student.nickname).toBe("Antigo");
  });

  it("é idempotente", async () => {
    run("infra/scripts/migrate.mjs", ["up"]);
    run("infra/scripts/migrate.mjs", ["up"]);

    const [row] = await query(
      "SELECT count(*)::integer AS count FROM pgmigrations",
    );
    expect(row.count).toBe(1);
  });
});
