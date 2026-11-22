import { ApiError } from "./errors.js";

/**
 * In-memory sliding-window limiter. Per process only: with several API
 * instances each one keeps its own counts (see backend/README.md).
 */
export function createRateLimiter({ windowMs, max, maxKeys = 10_000, now = Date.now }) {
  const hits = new Map();

  function prune(current) {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((timestamp) => current - timestamp >= windowMs)) hits.delete(key);
    }
  }

  return {
    hit(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((timestamp) => current - timestamp < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        throw new ApiError(429, "too_many_attempts", "Muitas tentativas. Aguarde um pouco e tente novamente.");
      }
      recent.push(current);
      hits.set(key, recent);
      if (hits.size > maxKeys) prune(current);
    },
    size: () => hits.size,
  };
}
