import pg from "pg";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";

export async function waitForWebServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/status`);
      await response.body?.cancel();
      return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "Servidor web não respondeu. Rode `npm run dev` antes dos testes.",
  );
}

export async function query(sql, values) {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  try {
    return (await client.query(sql, values)).rows;
  } finally {
    await client.end();
  }
}

export async function clearDatabase() {
  await query("TRUNCATE students, rate_limit_buckets RESTART IDENTITY CASCADE");
}

/** Zera os contadores de rate limit (os limites têm testes próprios). */
export async function resetRateLimits() {
  await query("DELETE FROM rate_limit_buckets");
}

export async function clearMailbox() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

export async function prepare() {
  await waitForWebServer();
  await clearDatabase();
  await clearMailbox();
}

/** Último e-mail enviado para `to` (Mailpit), com o texto completo; ou null. */
export async function getLastEmail(to) {
  const search = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  ).then((response) => response.json());
  const latest = search.messages?.[0];
  if (!latest) return null;
  return fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`).then((response) =>
    response.json(),
  );
}

/** Token do último link de confirmação enviado para `to`; ou null. */
export async function lastVerificationToken(to) {
  const email = await getLastEmail(to);
  return email?.Text.match(/token=([0-9a-f]{64})/)?.[1] ?? null;
}

export const PASSWORD = "senha-segura-1";
let nicknameCounter = 0;

export function uniqueNickname(prefix = "aluno") {
  nicknameCounter += 1;
  return `${prefix}_${process.pid}_${nicknameCounter}`.slice(0, 24);
}

/**
 * Cadastra um aluno; com verified (padrão), confirma o e-mail e faz login.
 * Retorna { nickname, email, id, cookie }.
 */
export async function createStudent({
  nickname = uniqueNickname(),
  verified = true,
} = {}) {
  const email = `${nickname}@example.com`.toLowerCase();
  await resetRateLimits();
  const registered = await request("/api/v1/auth/register", {
    method: "POST",
    body: { nickname, email, password: PASSWORD },
  });
  if (registered.status !== 201) {
    throw new Error(`cadastro falhou: ${JSON.stringify(registered.data)}`);
  }
  const student = { nickname, email, id: registered.data.student.id };
  if (!verified) return student;

  await query("UPDATE students SET email_verified_at = now() WHERE id = $1", [
    student.id,
  ]);
  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: { nickname, password: PASSWORD },
  });
  if (login.status !== 200) {
    throw new Error(`login falhou: ${JSON.stringify(login.data)}`);
  }
  return { ...student, cookie: login.cookie };
}

/** Requisição JSON que guarda o cookie de sessão retornado. */
export async function request(
  path,
  { method = "GET", body, cookie, headers = {}, redirect } = {},
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    redirect,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const setCookie = response.headers.getSetCookie?.()[0];
  return {
    status: response.status,
    data,
    headers: response.headers,
    setCookie,
    cookie: setCookie ? setCookie.split(";")[0] : cookie,
  };
}
