import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { createApiServer } from "../src/app.js";
import { runMigrations } from "../src/db/migrations-runner.js";
import { seedCourse } from "../src/db/seed.js";

const catalogPath = fileURLToPath(new URL("../src/data/course-catalog.json", import.meta.url));
export const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

function toPgResult(result) {
  const rows = result?.rows ?? [];
  const hasColumns = (result?.fields ?? []).length > 0;
  return { rows, rowCount: hasColumns ? rows.length : (result?.affectedRows ?? 0) };
}

// Types whose JS representation differs between PGlite and pg: int8, numeric, date,
// timestamp, timestamptz and their arrays. Parsing them with pg's own parsers keeps
// tests from passing on values production never sees (e.g. count(*) as a number).
const PG_PARSED_OIDS = [20, 1700, 1082, 1114, 1184, 1016, 1231, 1182, 1115, 1185];
const pgParsers = Object.fromEntries(PG_PARSED_OIDS.map((oid) => [oid, pg.types.getTypeParser(oid, "text")]));

export function createPglite() {
  return new PGlite({ parsers: pgParsers });
}

/**
 * Minimal pg-compatible facade over ONE PGlite connection. Requests run serially in
 * tests; concurrency (races, FOR UPDATE contention) cannot be tested with it. To avoid
 * silently running a pool query inside someone else's transaction, pool.query throws
 * while a transaction opened through connect() is active.
 */
export function createPgliteAdapter(db) {
  let inTransaction = false;
  const client = {
    async query(sql, params) {
      const statement = sql.trim().toUpperCase();
      if (statement === "BEGIN") inTransaction = true;
      if (statement === "COMMIT" || statement === "ROLLBACK") inTransaction = false;
      if (!params || params.length === 0) {
        const results = await db.exec(sql);
        return toPgResult(results.at(-1));
      }
      return toPgResult(await db.query(sql, params));
    },
    release() {},
  };
  return {
    query(sql, params) {
      if (inTransaction) {
        return Promise.reject(new Error("PGlite adapter is a single connection: pool.query called during an open transaction"));
      }
      return client.query(sql, params);
    },
    connect: async () => client,
    end: () => db.close(),
  };
}

let nicknameCounter = 0;
export function uniqueNickname(prefix = "aluno") {
  nicknameCounter += 1;
  return `${prefix}_${process.pid}_${nicknameCounter}`.slice(0, 24);
}

export async function createTestContext({ seed = true } = {}) {
  const db = createPglite();
  const pool = createPgliteAdapter(db);
  await runMigrations(await pool.connect());
  if (seed) await seedCourse(pool, catalog);

  const server = createApiServer(pool);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, cookie, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const setCookie = response.headers.get("set-cookie");
    return {
      status: response.status,
      text,
      body: text ? JSON.parse(text) : null,
      cookie: setCookie ? setCookie.split(";")[0] : null,
    };
  }

  async function registerStudent(nickname = uniqueNickname()) {
    const response = await request("POST", "/api/auth/register", {
      body: { nickname, password: "senha-segura-1" },
    });
    if (response.status !== 201) throw new Error(`register failed: ${response.status} ${response.text}`);
    return { nickname, cookie: response.cookie, student: response.body.student };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { pool, request, registerStudent, close };
}
