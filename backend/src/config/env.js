const isProduction = process.env.NODE_ENV === "production";
const sameSite = process.env.COOKIE_SAME_SITE ?? "Lax";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  appDatabaseUrl: () => required("DATABASE_URL"),
  migrationDatabaseUrl: () => required("DATABASE_DIRECT_URL"),
  sessionDays: 30,
  cookieSecure: isProduction,
  cookieSameSite: sameSite,
  databaseSsl: { rejectUnauthorized: true },
};

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

if (isProduction && !env.frontendOrigin.startsWith("https://")) {
  throw new Error("FRONTEND_ORIGIN must use HTTPS in production");
}

if (!["Lax", "Strict", "None"].includes(env.cookieSameSite)) {
  throw new Error("COOKIE_SAME_SITE must be Lax, Strict, or None");
}

if (env.cookieSameSite === "None" && !env.cookieSecure) {
  throw new Error("COOKIE_SAME_SITE=None requires NODE_ENV=production so cookies use Secure");
}
