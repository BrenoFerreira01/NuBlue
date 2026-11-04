import { useEffect, useState } from "react";
import type { CellStatus, Difficulty, Level, Screen, TabId } from "../../types/game";
import { LEVELS } from "../../data/levels";
import { generateDailyPuzzle } from "../challenges/generatePuzzle";
import { getLocalDateKey, getPreviousDateKey, type DailyChallengeStatus } from "../challenges/dailyChallenge";

interface SavedProgress {
  completedLevels: number[];
  totalXp: number;
  streak: number;
  totalSolved: number;
  lastActiveDate: string | null;
  dailyChallengeDate: string | null;
  dailyChallengeStatus: DailyChallengeStatus | null;
  dailyChallengesCompleted: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  lastDailyChallengeDate: string | null;
  dailyChallengeFills: Record<string, number | null>;
  dailyChallengeHearts: number;
}

const PROGRESS_STORAGE_KEY = "nublue-game-progress";
const TEMP_DAILY_PROGRESS_STORAGE_KEY = "nublue-daily-challenge-progress";
const EMPTY_PROGRESS: SavedProgress = {
  completedLevels: [],
  totalXp: 0,
  streak: 0,
  totalSolved: 0,
  lastActiveDate: null,
  dailyChallengeDate: null,
  dailyChallengeStatus: null,
  dailyChallengesCompleted: 0,
  currentDailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyChallengeDate: null,
  dailyChallengeFills: {},
  dailyChallengeHearts: 3,
};

function readSavedProgress(): SavedProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;

  try {
    const stored = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const dailyStored = window.localStorage.getItem(TEMP_DAILY_PROGRESS_STORAGE_KEY);
    if (!stored && !dailyStored) return EMPTY_PROGRESS;

    const value = stored ? JSON.parse(stored) as Partial<SavedProgress> : EMPTY_PROGRESS;
    let dailyValue = value;
    try {
      if (dailyStored) dailyValue = JSON.parse(dailyStored) as Partial<SavedProgress>;
    } catch {
      // Keep the challenge data that was already stored with the main progress.
    }
    const today = getLocalDateKey();
    const lastActiveDate = typeof value.lastActiveDate === "string" ? value.lastActiveDate : null;
    const streakIsActive = lastActiveDate === today || lastActiveDate === getPreviousDateKey(today);
    const validLevelIds = new Set(LEVELS.map((level) => level.id));

    return {
      completedLevels: Array.isArray(value.completedLevels)
        ? [...new Set(value.completedLevels.filter((id): id is number => Number.isInteger(id) && validLevelIds.has(id)))]
        : [],
      totalXp: Number.isFinite(value.totalXp) ? Math.max(0, Number(value.totalXp)) : 0,
      streak: streakIsActive && Number.isFinite(value.streak) ? Math.max(0, Number(value.streak)) : 0,
      totalSolved: Number.isFinite(value.totalSolved) ? Math.max(0, Number(value.totalSolved)) : 0,
      lastActiveDate,
      dailyChallengeDate: typeof dailyValue.dailyChallengeDate === "string" ? dailyValue.dailyChallengeDate : null,
      dailyChallengeStatus: dailyValue.dailyChallengeStatus === "in_progress" || dailyValue.dailyChallengeStatus === "completed" || dailyValue.dailyChallengeStatus === "failed"
        ? dailyValue.dailyChallengeStatus
        : null,
      dailyChallengesCompleted: Number.isFinite(dailyValue.dailyChallengesCompleted) ? Math.max(0, Number(dailyValue.dailyChallengesCompleted)) : 0,
      currentDailyStreak: Number.isFinite(dailyValue.currentDailyStreak) ? Math.max(0, Number(dailyValue.currentDailyStreak)) : 0,
      bestDailyStreak: Number.isFinite(dailyValue.bestDailyStreak) ? Math.max(0, Number(dailyValue.bestDailyStreak)) : 0,
      lastDailyChallengeDate: typeof dailyValue.lastDailyChallengeDate === "string" ? dailyValue.lastDailyChallengeDate : null,
      dailyChallengeFills: dailyValue.dailyChallengeFills && typeof dailyValue.dailyChallengeFills === "object"
        ? Object.fromEntries(
          Object.entries(dailyValue.dailyChallengeFills).filter((entry): entry is [string, number | null] =>
            ["p", "q", "r", "s"].includes(entry[0]) && (entry[1] === null || Number.isInteger(entry[1])),
          ),
        )
        : {},
      dailyChallengeHearts: Number.isInteger(dailyValue.dailyChallengeHearts)
        ? Math.min(3, Math.max(0, Number(dailyValue.dailyChallengeHearts)))
        : 3,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function useGameController() {
  const [screen, setScreen] = useState<Screen>("main");
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [progress, setProgress] = useState<SavedProgress>(readSavedProgress);
  const { completedLevels, totalXp, streak, totalSolved } = progress;
  const [today, setToday] = useState(getLocalDateKey);
  const [activeChallengeDate, setActiveChallengeDate] = useState<string | null>(null);
  const dailyChallengeStatus = progress.dailyChallengeDate === today ? progress.dailyChallengeStatus : null;
  const yesterday = getPreviousDateKey(today);
  const currentDailyStreak = progress.lastDailyChallengeDate === today || progress.lastDailyChallengeDate === yesterday
    ? progress.currentDailyStreak
    : 0;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday((current) => {
        const next = getLocalDateKey();
        return current === next ? current : next;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      window.localStorage.removeItem(TEMP_DAILY_PROGRESS_STORAGE_KEY);
    } catch {
      // Progress remains available for the current session if storage is disabled.
    }
  }, [progress]);

  const [currentLevel, setCurrentLevel] = useState<Level>(LEVELS[0]);
  const [fills, setFills] = useState<Record<string, number | null>>({});
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [hearts, setHearts] = useState(3);
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const [isChallenge, setIsChallenge] = useState(false);

  function startLevel(level: Level) {
    setCurrentLevel(level);
    setFills({});
    setSelectedBank(null);
    setHearts(3);
    setCellStatuses({});
    setIsCorrect(false);
    setHasChecked(false);
    setScreen("puzzle");
  }

  function startChallenge() {
    const isResume = progress.dailyChallengeDate === today && progress.dailyChallengeStatus === "in_progress";
    if (progress.dailyChallengeDate === today && progress.dailyChallengeStatus !== null && !isResume) return;
    setActiveChallengeDate(today);
    setIsChallenge(true);
    const puzzle = generateDailyPuzzle(today);
    startLevel(puzzle);
    if (isResume) {
      setFills(progress.dailyChallengeFills);
      setHearts(progress.dailyChallengeHearts);
    } else {
      setProgress((previous) => ({
        ...previous,
        dailyChallengeDate: today,
        dailyChallengeStatus: "in_progress",
        dailyChallengeFills: {},
        dailyChallengeHearts: 3,
      }));
    }
  }

  function handleEndChallenge() {
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab("challenges");
    setScreen("main");
  }

  function handleCellClick(inputId: string) {
    if (hasChecked) return;
    const nextFill = selectedBank !== null ? selectedBank : null;
    if (selectedBank !== null) {
      setFills((previous) => ({ ...previous, [inputId]: nextFill }));
      setSelectedBank(null);
    } else {
      setFills((previous) => ({ ...previous, [inputId]: null }));
    }
    if (isChallenge) {
      setProgress((previous) => ({
        ...previous,
        dailyChallengeFills: { ...previous.dailyChallengeFills, [inputId]: nextFill },
      }));
    }
  }

  function handleDropNumber(inputId: string, number: number) {
    if (hasChecked || !(inputId in currentLevel.answers)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
    if (isChallenge) {
      setProgress((previous) => ({
        ...previous,
        dailyChallengeFills: { ...previous.dailyChallengeFills, [inputId]: number },
      }));
    }
  }

  function handleBankClick(number: number) {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  }

  function checkAnswers() {
    if (hasChecked) return;
    const statuses: Record<string, CellStatus> = {};
    let allCorrect = true;

    for (const [id, answer] of Object.entries(currentLevel.answers)) {
      const correct = fills[id] === answer;
      statuses[id] = correct ? "correct" : "wrong";
      if (!correct) allCorrect = false;
    }

    setCellStatuses(statuses);
    setHasChecked(true);
    setIsCorrect(allCorrect);

    if (allCorrect) {
      setProgress((previous) => {
        const activeDate = isChallenge ? activeChallengeDate ?? today : today;
        const activeDateYesterday = getPreviousDateKey(activeDate);
        const nextStreak = previous.lastActiveDate === activeDate
          ? previous.streak
          : previous.lastActiveDate === activeDateYesterday
            ? previous.streak + 1
            : 1;
        const alreadyResolvedDailyChallenge = isChallenge && previous.dailyChallengeDate === activeDate &&
          (previous.dailyChallengeStatus === "completed" || previous.dailyChallengeStatus === "failed");
        const nextDailyStreak = previous.lastDailyChallengeDate === activeDate
          ? previous.currentDailyStreak
          : previous.lastDailyChallengeDate === activeDateYesterday
            ? previous.currentDailyStreak + 1
            : 1;

        return {
          ...previous,
          completedLevels: isChallenge
            ? previous.completedLevels
            : [...new Set([...previous.completedLevels, currentLevel.id])],
          totalSolved: previous.totalSolved + (alreadyResolvedDailyChallenge ? 0 : 1),
          totalXp: previous.totalXp + (alreadyResolvedDailyChallenge ? 0 : currentLevel.xpReward),
          streak: alreadyResolvedDailyChallenge ? previous.streak : nextStreak,
          lastActiveDate: alreadyResolvedDailyChallenge ? previous.lastActiveDate : activeDate,
          dailyChallengeDate: isChallenge ? activeDate : previous.dailyChallengeDate,
          dailyChallengeStatus: isChallenge ? "completed" : previous.dailyChallengeStatus,
          dailyChallengesCompleted: isChallenge && !alreadyResolvedDailyChallenge
            ? previous.dailyChallengesCompleted + 1
            : previous.dailyChallengesCompleted,
          currentDailyStreak: isChallenge && !alreadyResolvedDailyChallenge ? nextDailyStreak : previous.currentDailyStreak,
          bestDailyStreak: isChallenge && !alreadyResolvedDailyChallenge
            ? Math.max(previous.bestDailyStreak, nextDailyStreak)
            : previous.bestDailyStreak,
          lastDailyChallengeDate: isChallenge && !alreadyResolvedDailyChallenge ? activeDate : previous.lastDailyChallengeDate,
        };
      });
      setTimeout(() => setScreen("result"), 1300);
      return;
    }

    const remainingHearts = hearts - 1;
    setHearts(remainingHearts);
    if (remainingHearts <= 0) {
      if (isChallenge) {
        const activeDate = activeChallengeDate ?? today;
        setProgress((previous) => ({
          ...previous,
          dailyChallengeDate: activeDate,
          dailyChallengeStatus: "failed",
          currentDailyStreak: 0,
          lastDailyChallengeDate: activeDate,
          dailyChallengeFills: fills,
          dailyChallengeHearts: 0,
        }));
      }
      setTimeout(() => setScreen("result"), 950);
    } else {
      if (isChallenge) {
        setProgress((previous) => ({
          ...previous,
          dailyChallengeFills: fills,
          dailyChallengeHearts: remainingHearts,
        }));
      }
      setTimeout(() => {
        setCellStatuses({});
        setHasChecked(false);
      }, 1500);
    }
  }

  function handlePuzzleBack() {
    const wasChallenge = isChallenge;
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab(wasChallenge ? "challenges" : "home");
    setScreen("main");
  }

  function handleResultContinue() {
    setActiveTab("home");
    setScreen("main");
  }

  const canCheck = Object.keys(currentLevel.answers).every((id) => fills[id] != null);

  return {
    screen,
    activeTab,
    setActiveTab,
    difficulty,
    setDifficulty,
    completedLevels,
    totalXp,
    streak,
    totalSolved,
    dailyChallengeStatus,
    dailyChallengesCompleted: progress.dailyChallengesCompleted,
    currentDailyStreak,
    bestDailyStreak: progress.bestDailyStreak,
    today,
    currentLevel,
    fills,
    selectedBank,
    hearts,
    cellStatuses,
    isCorrect,
    hasChecked,
    isChallenge,
    canCheck,
    startLevel,
    startChallenge,
    handleEndChallenge,
    handleCellClick,
    handleDropNumber,
    handleBankClick,
    checkAnswers,
    handlePuzzleBack,
    handleResultContinue,
  };
}
