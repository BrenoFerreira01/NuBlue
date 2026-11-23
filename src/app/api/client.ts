import type { Level } from "../types/game";
import { isSessionExpiry, notifySessionExpired } from "./sessionEvents";

// Production builds (GitHub Pages) must receive VITE_API_URL at build time. Without
// it they never fall back to localhost: requests fail and the app stays in visitor mode.
const apiBaseUrl = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "")).replace(/\/$/, "");
export const isApiConfigured = apiBaseUrl !== "";
const errorMessages: Record<string, string> = {
  authentication_required: "Sua sessão expirou. Entre novamente.",
  course_not_seeded: "O curso ainda não foi preparado no banco de dados.",
  invalid_credentials: "Apelido ou senha incorretos.",
  invalid_nickname: "Use um apelido de 3 a 24 letras, números, _ ou -.",
  invalid_password: "A senha precisa ter entre 8 e 128 caracteres.",
  level_locked: "Complete o nível anterior para continuar.",
  nickname_taken: "Esse apelido já está em uso.",
  request_failed: "Não foi possível concluir essa ação. Tente novamente.",
  too_many_attempts: "Muitas tentativas. Aguarde um pouco e tente novamente.",
};

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface StudentAccount {
  id: string;
  nickname: string;
  leaderboardOptIn: boolean;
}

export interface RemoteProgress {
  totalXp: number;
  totalSolved: number;
  streak: number;
  dailyChallengesCompleted: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  completedLevels: number[];
}

export interface LevelAvailability {
  levels: Array<{ id: number; status: "locked" | "available" | "completed" }>;
  bonusAvailable: boolean;
}

export interface CourseCatalog {
  chapters: { id: number; title: string; description: string }[];
  levels: Level[];
}

export interface DailyChallenge {
  date: string;
  status: "in_progress" | "completed" | "failed";
  hearts: number;
  attemptCount: number;
  fills: Record<string, number | null>;
  level: Level;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiClientError(0, "api_not_configured", "O servidor da Nublue não está configurado neste site.");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (isSessionExpiry(path, response.status, payload?.error)) notifySessionExpired();
    throw new ApiClientError(
      response.status,
      payload?.error ?? "request_failed",
      payload?.message ?? errorMessages[payload?.error] ?? errorMessages.request_failed,
    );
  }
  return payload as T;
}

function post(body?: unknown): RequestInit {
  return { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export const api = {
  catalog: () => request<CourseCatalog>("/api/catalog"),
  bonusLevel: () => request<{ level: Level }>("/api/catalog/bonus/very-hard"),
  me: () => request<{ student: StudentAccount; progress: RemoteProgress }>("/api/me"),
  progress: () => request<RemoteProgress>("/api/progress"),
  availability: () => request<LevelAvailability>("/api/progress/availability"),
  register: (nickname: string, password: string) =>
    request<{ student: StudentAccount }>("/api/auth/register", post({ nickname, password })),
  login: (nickname: string, password: string) =>
    request<{ student: StudentAccount }>("/api/auth/login", post({ nickname, password })),
  logout: () => request<{ ok: true }>("/api/auth/logout", post()),
  deleteAccount: () => request<{ ok: true }>("/api/me", { method: "DELETE" }),
  attempt: (levelId: number, answers: Record<string, number>, idempotencyKey: string) =>
    request<{ correct: boolean; xpAwarded: number; progress: RemoteProgress }>(
      "/api/attempts",
      post({ levelId, answers, idempotencyKey }),
    ),
  dailyChallenge: () => request<DailyChallenge>("/api/daily-challenge"),
  dailyAttempt: (answers: Record<string, number>, idempotencyKey: string) =>
    request<{
      correct: boolean;
      xpAwarded: number;
      status: "in_progress" | "completed" | "failed";
      hearts: number;
      progress: RemoteProgress;
    }>("/api/daily-challenge/attempt", post({ answers, idempotencyKey })),
  saveDailyDraft: (answers: Record<string, number>) =>
    request<{ saved: true }>("/api/daily-challenge/draft", post({ answers })),
  leaderboard: (period: "weekly" | "all") =>
    request<{ period: "weekly" | "all"; entries: { nickname: string; xp: number; streak: number }[] }>(
      `/api/leaderboard?period=${period}`,
    ),
  setLeaderboardVisibility: (enabled: boolean) =>
    request<{ leaderboardOptIn: boolean }>(
      "/api/me/leaderboard-visibility",
      { method: "PATCH", body: JSON.stringify({ enabled }), headers: { "content-type": "application/json" } },
    ),
};
