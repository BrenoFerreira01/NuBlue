export type Screen = "main" | "puzzle" | "result";
export type TabId = "home" | "challenges" | "ranking" | "profile" | "settings";
export type Difficulty = "easy" | "medium" | "hard" | "very_hard";
export type CellStatus = "correct" | "wrong" | null;

export interface GridCell {
  type: "number" | "operator" | "equals";
  value?: number | string;
  inputId?: string;
  isVertical?: boolean;
}

export interface Level {
  id: number;
  chapter: number;
  unit?: number;
  unitTitle?: string;
  session: number;
  title: string;
  subtitle: string;
  instruction?: string;
  difficulty: Difficulty;
  xpReward: number;
  emoji: string;
  grid: (GridCell | null)[][];
  bank: number[];
  inputIds?: string[];
  answers?: Record<string, number>;
  isBonus?: boolean;
}

export interface MockPlayer {
  id: number;
  name: string;
  xp: number;
  weeklyXp: number;
  streak: number;
  emoji: string;
}

