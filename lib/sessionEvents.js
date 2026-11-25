const listeners = new Set();

/**
 * Um 401 `authentication_required` significa que a sessão que o app usava sumiu.
 * Ficam de fora o GET /users/me (o visitante o chama ao abrir o site, sem
 * sessão) e as rotas de login, que mostram os próprios erros no formulário.
 */
export function isSessionExpiry(path, method, status, code) {
  if (status !== 401 || code !== "authentication_required") return false;
  const pathname = path.split("?")[0];
  if (pathname.startsWith("/api/v1/auth/")) return false;
  return !(pathname === "/api/v1/users/me" && method === "GET");
}

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired() {
  for (const listener of [...listeners]) listener();
}
