const isProduction = process.env.NODE_ENV === "production";
const sameSite = process.env.COOKIE_SAME_SITE ?? "Lax";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integer(name, fallback, { min, max }) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

/**
 * FRONTEND_ORIGIN accepts a comma-separated list, e.g. the GitHub Pages origin plus
 * the local Vite server. Origins never carry a path: https://user.github.io, not
 * https://user.github.io/NuBlue/.
 */
export function parseOrigins(value) {
  const origins = value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    let url;
    try {
      url = new URL(item);
    } catch {
      throw new Error(`FRONTEND_ORIGIN has an invalid URL: ${item}`);
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`FRONTEND_ORIGIN must be an origin without path: ${item}`);
    }
    return url.origin;
  });
  if (!origins.length) throw new Error("FRONTEND_ORIGIN must list at least one origin");
  return origins;
}

function databaseSsl() {
  const mode = process.env.DATABASE_SSL ?? "verify-full";
  if (mode === "verify-full") return { rejectUnauthorized: true };
  if (mode === "disable") {
    if (isProduction) throw new Error("DATABASE_SSL=disable is not allowed in production");
    return false;
  }
  throw new Error("DATABASE_SSL must be verify-full or disable");
}

const frontendOrigins = parseOrigins(process.env.FRONTEND_ORIGIN ?? "http://localhost:5173");
const rateLimitStore = process.env.RATE_LIMIT_STORE ?? (isProduction ? "postgres" : "memory");

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  port: integer("PORT", 4000, { min: 1, max: 65535 }),
  frontendOrigins,
  appDatabaseUrl: () => required("DATABASE_URL"),
  migrationDatabaseUrl: () => required("DATABASE_DIRECT_URL"),
  databaseSsl: databaseSsl(),
  databasePoolMax: integer("DATABASE_POOL_MAX", 10, { min: 1, max: 100 }),
  sessionDays: 30,
  cookieSecure: isProduction,
  cookieSameSite: sameSite,
  // Number of reverse proxies in front of the API that append to X-Forwarded-For.
  // 0 = use the socket address (direct exposure or unknown proxy chain).
  trustProxyHops: integer("TRUST_PROXY_HOPS", 0, { min: 0, max: 5 }),
  rateLimitStore,
};

if (isProduction && frontendOrigins.some((origin) => !origin.startsWith("https://"))) {
  throw new Error("FRONTEND_ORIGIN must use HTTPS in production");
}

if (!["Lax", "Strict", "None"].includes(env.cookieSameSite)) {
  throw new Error("COOKIE_SAME_SITE must be Lax, Strict, or None");
}

if (env.cookieSameSite === "None" && !env.cookieSecure) {
  throw new Error("COOKIE_SAME_SITE=None requires NODE_ENV=production so cookies use Secure");
}

if (!["memory", "postgres"].includes(rateLimitStore)) {
  throw new Error("RATE_LIMIT_STORE must be memory or postgres");
}
