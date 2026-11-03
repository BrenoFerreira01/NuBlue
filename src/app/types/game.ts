export type Screen = "main" | "puzzle" | "result";
export type TabId = "home" | "challenges" | "ranking" | "profile";
export type Difficulty = "easy" | "medium" | "hard";
export type CellStatus = "correct" | "wrong" | null;

export interface GridCell {
  type: "number" | "operator" | "equals";
  value?: number | string;
  inputId?: string;
  isVertical?: boolean;
}

export interface Level {
  id: number;
  title: string;
  subtitle: string;
  difficulty: Difficulty;
  xpReward: number;
  emoji: string;
  grid: (GridCell | null)[][];
  bank: number[];
  answers: Record<string, number>;
}

export interface LockedStub {
  id: number;
  title: string;
  difficulty: Difficulty;
  emoji: string;
  isLocked: true;
}

export interface MockPlayer {
  id: number;
  name: string;
  xp: number;
  weeklyXp: number;
  streak: number;
  emoji: string;
}

