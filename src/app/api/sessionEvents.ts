type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

/**
 * A 401 `authentication_required` means a session the app relied on is gone.
 * `/api/me` is excluded because visitors hit it on startup without a session,
 * and auth routes report their own errors to the login form.
 */
export function isSessionExpiry(path: string, status: number, code: string | undefined): boolean {
  if (status !== 401 || code !== "authentication_required") return false;
  const pathname = path.split("?")[0];
  return pathname !== "/api/me" && !pathname.startsWith("/api/auth/");
}

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of [...listeners]) listener();
}
