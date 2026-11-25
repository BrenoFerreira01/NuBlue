// Utilidades de requisição HTTP: cookies, origem e endereço do cliente.

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      // Cookie malformado: ignorado.
    }
  }
  return cookies;
}

/** Cookie de sessão: HttpOnly, SameSite=Lax, Path=/ e Secure em produção. */
export function serializeCookie(name, value, { maxAge } = {}) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAge !== undefined) attributes.push(`Max-Age=${maxAge}`);
  if (isProduction()) attributes.push("Secure");
  return attributes.join("; ");
}

export function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  const list = current ? [].concat(current) : [];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

/**
 * IP do cliente para rate limit. Na Vercel o proxy reescreve x-forwarded-for com
 * o IP real; fora dela o cabeçalho pode ser forjado e só é usado com
 * TRUST_PROXY_HOPS configurado.
 */
export function clientAddress(req) {
  const chain = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (process.env.VERCEL === "1" && chain.length) return chain[0];
  // Hospedagem própria atrás de N proxies (ex.: Caddy): cada proxy acrescenta um
  // endereço à direita, então o cliente real é o N-ésimo da direita. Os da
  // esquerda vêm do próprio cliente e não são confiáveis.
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (hops > 0 && chain.length >= hops) return chain[chain.length - hops];
  return req.socket?.remoteAddress || "unknown";
}

/** URL pública do site, sem barra final (usada nos links dos e-mails). */
export function appUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Origens aceitas em requisições que alteram estado. */
export function allowedOrigins(req) {
  const origins = new Set([new URL(appUrl()).origin]);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) {
    const proto =
      req.headers["x-forwarded-proto"] ||
      (req.socket?.encrypted ? "https" : "http");
    origins.add(`${String(proto).split(",")[0].trim()}://${host}`);
  }
  return origins;
}
