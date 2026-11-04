export type LandingDailyStatus = "in_progress" | "completed" | "failed";

export interface LandingDailyProgress {
  date: string;
  status: LandingDailyStatus;
  fills: Record<string, number | null>;
  hearts: number;
}

const STORAGE_KEY = "nublue-landing-daily-challenge";

export function readLandingDailyProgress(date: string): LandingDailyProgress | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const value = JSON.parse(stored) as Partial<LandingDailyProgress>;
    if (
      value.date !== date ||
      (value.status !== "in_progress" && value.status !== "completed" && value.status !== "failed")
    ) {
      return null;
    }

    const fills = value.fills && typeof value.fills === "object"
      ? Object.fromEntries(
        Object.entries(value.fills).filter((entry): entry is [string, number | null] =>
          ["p", "q", "r", "s"].includes(entry[0]) && (entry[1] === null || Number.isInteger(entry[1])),
        ),
      )
      : {};

    return {
      date,
      status: value.status,
      fills,
      hearts: Number.isInteger(value.hearts) ? Math.min(3, Math.max(0, Number(value.hearts))) : 3,
    };
  } catch {
    return null;
  }
}

export function saveLandingDailyProgress(progress: LandingDailyProgress): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The challenge still works for this visit when browser storage is unavailable.
  }
}
