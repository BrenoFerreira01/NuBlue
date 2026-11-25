import {
  isSessionExpiry,
  notifySessionExpired,
  onSessionExpired,
} from "lib/sessionEvents.js";

const expired = (path, method = "GET") =>
  isSessionExpiry(path, method, 401, "authentication_required");

describe("isSessionExpiry", () => {
  it("um 401 authentication_required numa rota da conta é sessão expirada", () => {
    expect(expired("/api/v1/attempts", "POST")).toBe(true);
    expect(expired("/api/v1/users/me/availability")).toBe(true);
    expect(expired("/api/v1/daily-challenge")).toBe(true);
    expect(expired("/api/v1/users/me", "PATCH")).toBe(true);
    expect(expired("/api/v1/users/me", "DELETE")).toBe(true);
  });

  it("a checagem inicial de identidade e as rotas de login não contam", () => {
    expect(expired("/api/v1/users/me")).toBe(false);
    expect(expired("/api/v1/auth/logout", "POST")).toBe(false);
    expect(
      isSessionExpiry("/api/v1/auth/login", "POST", 401, "invalid_credentials"),
    ).toBe(false);
  });

  it("outros erros não são sessão expirada", () => {
    expect(
      isSessionExpiry("/api/v1/attempts", "POST", 403, "level_locked"),
    ).toBe(false);
    expect(isSessionExpiry("/api/v1/attempts", "POST", 500, undefined)).toBe(
      false,
    );
  });
});

describe("onSessionExpired", () => {
  it("avisa os ouvintes até eles se desinscreverem", () => {
    let calls = 0;
    const unsubscribe = onSessionExpired(() => {
      calls += 1;
    });

    notifySessionExpired();
    unsubscribe();
    notifySessionExpired();

    expect(calls).toBe(1);
  });
});
