// Configuração de conexão compartilhada pela aplicação e pelos scripts de infra
// (migrações, seed, espera do Postgres). Arquivo .mjs para rodar direto no Node.

const IGNORED_URL_PARAMS = ["sslmode", "channel_binding", "sslrootcert"];

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * SSL sempre verifica o certificado. Só um Postgres local (Docker, CI) pode
 * desligá-lo, com DATABASE_SSL=disable, e nunca em produção.
 */
function sslConfig() {
  if (process.env.DATABASE_SSL === "disable") {
    if (isProduction()) {
      throw new Error("DATABASE_SSL=disable não é permitido em produção.");
    }
    return false;
  }
  return { rejectUnauthorized: true };
}

/**
 * O Neon entrega URLs com ?sslmode=require&channel_binding=require. O driver pg
 * trataria sslmode por conta própria; removemos esses parâmetros e aplicamos
 * sempre a configuração de sslConfig().
 */
function cleanConnectionString(value) {
  const url = new URL(value);
  for (const param of IGNORED_URL_PARAMS) url.searchParams.delete(param);
  return url.toString();
}

/**
 * migration: usa a conexão direta (DATABASE_URL_UNPOOLED), necessária para DDL
 * e locks de sessão; sem ela, cai na DATABASE_URL.
 */
export function getConnectionConfig({ migration = false } = {}) {
  const url =
    (migration && process.env.DATABASE_URL_UNPOOLED) ||
    process.env.DATABASE_URL;

  if (url) {
    return { connectionString: cleanConnectionString(url), ssl: sslConfig() };
  }

  return {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: sslConfig(),
  };
}
