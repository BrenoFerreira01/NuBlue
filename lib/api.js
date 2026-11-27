import { isSessionExpiry, notifySessionExpired } from "lib/sessionEvents";

// A API mora no mesmo site (/api/v1): sem URL base, sem CORS e sem cookie de terceiros.

const errorMessages = {
  authentication_required: "Sua sessão expirou. Entre novamente.",
  course_not_seeded: "O curso ainda não foi preparado no banco de dados.",
  email_not_verified:
    "Confirme seu e-mail para entrar. Enviamos um link para você.",
  invalid_credentials: "Apelido ou senha incorretos.",
  invalid_email: "Informe um e-mail válido.",
  invalid_nickname: "Use um apelido de 3 a 24 letras, números, _ ou -.",
  invalid_password: "A senha precisa ter entre 8 e 128 caracteres.",
  invalid_verification_token: "Este link de confirmação é inválido ou expirou.",
  level_locked: "Complete o nível anterior para continuar.",
  nickname_taken: "Esse apelido já está em uso.",
  request_failed: "Não foi possível concluir essa ação. Tente novamente.",
  too_many_attempts: "Muitas tentativas. Aguarde um pouco e tente novamente.",
};

export class ApiClientError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, "request_failed", errorMessages.request_failed);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error ?? "request_failed";
    if (isSessionExpiry(path, method, response.status, code)) {
      notifySessionExpired();
    }
    throw new ApiClientError(
      response.status,
      code,
      errorMessages[code] ?? payload?.message ?? errorMessages.request_failed,
    );
  }
  return payload;
}

const post = (path, body) => request(path, { method: "POST", body });

export const api = {
  catalog: () => request("/api/v1/catalog"),
  bonusLevel: () => request("/api/v1/catalog/bonus"),
  me: () => request("/api/v1/users/me"),
  progress: () => request("/api/v1/users/me").then(({ progress }) => progress),
  availability: () => request("/api/v1/users/me/availability"),
  register: (nickname, email, password) =>
    post("/api/v1/auth/register", { nickname, email, password }),
  verifyEmail: (token) =>
    request("/api/v1/auth/email-verification", {
      method: "PATCH",
      body: { token },
    }),
  /** `email` corrige o endereço de uma conta ainda não confirmada. */
  resendVerification: (nickname, password, email) =>
    post("/api/v1/auth/email-verification", { nickname, password, email }),
  login: (nickname, password) =>
    post("/api/v1/auth/login", { nickname, password }),
  logout: () => post("/api/v1/auth/logout"),
  deleteAccount: () => request("/api/v1/users/me", { method: "DELETE" }),
  /** Uma cruzadinha da lição: { difficulty, puzzleIndex, lessonId }. */
  attempt: (levelId, answers, idempotencyKey, lessonTarget) =>
    post("/api/v1/attempts", {
      levelId,
      answers,
      idempotencyKey,
      ...lessonTarget,
    }),
  placement: (chapter, difficulty) =>
    post("/api/v1/placement", { chapter, difficulty }),
  setDifficulty: (difficulty) =>
    request("/api/v1/users/me", { method: "PATCH", body: { difficulty } }),
  dailyChallenge: () => request("/api/v1/daily-challenge"),
  dailyAttempt: (answers, idempotencyKey) =>
    post("/api/v1/daily-challenge/attempts", { answers, idempotencyKey }),
  saveDailyDraft: (answers) =>
    request("/api/v1/daily-challenge/draft", {
      method: "PUT",
      body: { answers },
    }),
  leaderboard: (period) => request(`/api/v1/leaderboard?period=${period}`),
  setLeaderboardVisibility: (enabled) =>
    request("/api/v1/users/me", {
      method: "PATCH",
      body: { leaderboardOptIn: enabled },
    }),
};
