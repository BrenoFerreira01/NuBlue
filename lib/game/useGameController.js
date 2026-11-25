import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "lib/api";
import { LEVELS } from "lib/game/levels";
import { generateDailyPuzzle } from "lib/game/generatePuzzle";
import { getLocalDateKey, getPreviousDateKey } from "lib/game/dailyChallenge";
const PROGRESS_STORAGE_KEY = "nublue-game-progress";
const TEMP_DAILY_PROGRESS_STORAGE_KEY = "nublue-daily-challenge-progress";
const EMPTY_PROGRESS = {
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
function readSavedProgress() {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const stored = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const dailyStored = window.localStorage.getItem(
      TEMP_DAILY_PROGRESS_STORAGE_KEY,
    );
    if (!stored && !dailyStored) return EMPTY_PROGRESS;
    const value = stored ? JSON.parse(stored) : EMPTY_PROGRESS;
    let dailyValue = value;
    try {
      if (dailyStored) dailyValue = JSON.parse(dailyStored);
    } catch {
      // Keep the challenge data that was already stored with the main progress.
    }
    const today = getLocalDateKey();
    const lastActiveDate =
      typeof value.lastActiveDate === "string" ? value.lastActiveDate : null;
    const streakIsActive =
      lastActiveDate === today || lastActiveDate === getPreviousDateKey(today);
    const validLevelIds = new Set(LEVELS.map((level) => level.id));
    return {
      completedLevels: Array.isArray(value.completedLevels)
        ? [
            ...new Set(
              value.completedLevels.filter(
                (id) => Number.isInteger(id) && validLevelIds.has(id),
              ),
            ),
          ]
        : [],
      totalXp: Number.isFinite(value.totalXp)
        ? Math.max(0, Number(value.totalXp))
        : 0,
      streak:
        streakIsActive && Number.isFinite(value.streak)
          ? Math.max(0, Number(value.streak))
          : 0,
      totalSolved: Number.isFinite(value.totalSolved)
        ? Math.max(0, Number(value.totalSolved))
        : 0,
      lastActiveDate,
      dailyChallengeDate:
        typeof dailyValue.dailyChallengeDate === "string"
          ? dailyValue.dailyChallengeDate
          : null,
      dailyChallengeStatus:
        dailyValue.dailyChallengeStatus === "in_progress" ||
        dailyValue.dailyChallengeStatus === "completed" ||
        dailyValue.dailyChallengeStatus === "failed"
          ? dailyValue.dailyChallengeStatus
          : null,
      dailyChallengesCompleted: Number.isFinite(
        dailyValue.dailyChallengesCompleted,
      )
        ? Math.max(0, Number(dailyValue.dailyChallengesCompleted))
        : 0,
      currentDailyStreak: Number.isFinite(dailyValue.currentDailyStreak)
        ? Math.max(0, Number(dailyValue.currentDailyStreak))
        : 0,
      bestDailyStreak: Number.isFinite(dailyValue.bestDailyStreak)
        ? Math.max(0, Number(dailyValue.bestDailyStreak))
        : 0,
      lastDailyChallengeDate:
        typeof dailyValue.lastDailyChallengeDate === "string"
          ? dailyValue.lastDailyChallengeDate
          : null,
      dailyChallengeFills:
        dailyValue.dailyChallengeFills &&
        typeof dailyValue.dailyChallengeFills === "object"
          ? Object.fromEntries(
              Object.entries(dailyValue.dailyChallengeFills).filter(
                (entry) =>
                  ["p", "q", "r", "s"].includes(entry[0]) &&
                  (entry[1] === null || Number.isInteger(entry[1])),
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
function inputIdsFor(level) {
  return level.inputIds ?? Object.keys(level.answers ?? {});
}
function getUtcDateKey() {
  return new Date().toISOString().slice(0, 10);
}
function applyRemoteProgress(current, remote) {
  return {
    ...current,
    completedLevels: remote.completedLevels,
    totalXp: remote.totalXp,
    streak: remote.streak,
    totalSolved: remote.totalSolved,
    dailyChallengesCompleted: remote.dailyChallengesCompleted,
    currentDailyStreak: remote.currentDailyStreak,
    bestDailyStreak: remote.bestDailyStreak,
  };
}
function toSavedAnswers(fills) {
  return Object.fromEntries(
    Object.entries(fills).filter((entry) => entry[1] !== null),
  );
}
export function useGameController({
  levels = LEVELS,
  authenticated = false,
} = {}) {
  const [screen, setScreen] = useState("main");
  const [activeTab, setActiveTab] = useState("home");
  const [difficulty, setDifficulty] = useState("medium");
  const [progress, setProgress] = useState(readSavedProgress);
  const [remoteProgressReady, setRemoteProgressReady] = useState(false);
  const [levelAvailability, setLevelAvailability] = useState(null);
  const availabilityRequest = useRef(0);
  const visibleProgress =
    authenticated && !remoteProgressReady ? EMPTY_PROGRESS : progress;
  const { completedLevels, totalXp, streak, totalSolved } = visibleProgress;
  const [today, setToday] = useState(getLocalDateKey);
  const [activeChallengeDate, setActiveChallengeDate] = useState(null);
  const dailyChallengeStatus =
    visibleProgress.dailyChallengeDate === today
      ? visibleProgress.dailyChallengeStatus
      : null;
  const yesterday = getPreviousDateKey(today);
  const currentDailyStreak = authenticated
    ? visibleProgress.currentDailyStreak
    : visibleProgress.lastDailyChallengeDate === today ||
        visibleProgress.lastDailyChallengeDate === yesterday
      ? visibleProgress.currentDailyStreak
      : 0;
  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday((current) => {
        const next = authenticated ? getUtcDateKey() : getLocalDateKey();
        return current === next ? current : next;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [authenticated]);
  useEffect(() => {
    if (authenticated) return;
    try {
      window.localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify(progress),
      );
      window.localStorage.removeItem(TEMP_DAILY_PROGRESS_STORAGE_KEY);
    } catch {
      // Progress remains available for the current session if storage is disabled.
    }
  }, [progress, authenticated]);
  const [currentLevel, setCurrentLevel] = useState(levels[0] ?? LEVELS[0]);
  const [fills, setFills] = useState({});
  const [selectedBank, setSelectedBank] = useState(null);
  const [hearts, setHearts] = useState(3);
  const [cellStatuses, setCellStatuses] = useState({});
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isChallenge, setIsChallenge] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const dailyDraftTimer = useRef(null);
  const attemptRequest = useRef(null);
  const refreshLevelAvailability = useCallback(async (attempt = 0) => {
    const requestId = ++availabilityRequest.current;
    try {
      const availability = await api.availability();
      if (availabilityRequest.current === requestId)
        setLevelAvailability(availability);
    } catch {
      // Keep the last known state; the trail stays locked only until a first successful load.
      if (availabilityRequest.current !== requestId || attempt >= 3) return;
      window.setTimeout(
        () => {
          if (availabilityRequest.current === requestId)
            void refreshLevelAvailability(attempt + 1);
        },
        2_000 * 2 ** attempt,
      );
    }
  }, []);
  function idempotencyKeyFor(challenge, levelId, answers) {
    const fingerprint = JSON.stringify({
      challenge,
      date: challenge ? (activeChallengeDate ?? today) : null,
      levelId,
      answers,
    });
    if (attemptRequest.current?.fingerprint === fingerprint) {
      return attemptRequest.current.idempotencyKey;
    }
    const idempotencyKey = crypto.randomUUID();
    attemptRequest.current = { fingerprint, idempotencyKey };
    return idempotencyKey;
  }
  function queueDailyDraft(nextFills) {
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = window.setTimeout(() => {
      api.saveDailyDraft(toSavedAnswers(nextFills)).catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o desafio.",
        );
      });
    }, 300);
  }
  function saveDailyDraftNow(currentFills) {
    api.saveDailyDraft(toSavedAnswers(currentFills)).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o desafio.",
      );
    });
  }
  useEffect(() => {
    if (!authenticated) {
      availabilityRequest.current += 1;
      setLevelAvailability(null);
      setRemoteProgressReady(false);
      setProgress(readSavedProgress());
      return;
    }
    let active = true;
    setRemoteProgressReady(false);
    setLevelAvailability(null);
    api
      .progress()
      .then((remote) => {
        if (!active) return;
        setProgress((current) => applyRemoteProgress(EMPTY_PROGRESS, remote));
        setRemoteProgressReady(true);
      })
      .catch(() => undefined);
    void refreshLevelAvailability();
    api
      .dailyChallenge()
      .then((challenge) => {
        if (!active) return;
        setToday(challenge.date);
        setProgress((current) => ({
          ...current,
          dailyChallengeDate: challenge.date,
          dailyChallengeStatus: challenge.status,
          dailyChallengeFills: challenge.fills,
          dailyChallengeHearts: challenge.hearts,
          lastDailyChallengeDate: challenge.date,
        }));
      })
      .catch(() => undefined);
    const refreshOnFocus = () => void refreshLevelAvailability();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      availabilityRequest.current += 1;
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [authenticated, refreshLevelAvailability]);
  function startLevel(level, dailyChallenge = false) {
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = null;
    setIsChallenge(dailyChallenge);
    setCurrentLevel(level);
    setFills({});
    setSelectedBank(null);
    setHearts(3);
    setCellStatuses({});
    setIsCorrect(false);
    setHasChecked(false);
    setXpEarned(0);
    setErrorMessage(null);
    setScreen("puzzle");
  }
  async function startChallenge() {
    if (authenticated) {
      try {
        const challenge = await api.dailyChallenge();
        setToday(challenge.date);
        setActiveChallengeDate(challenge.date);
        setProgress((current) => ({
          ...current,
          dailyChallengeDate: challenge.date,
          dailyChallengeStatus: challenge.status,
          dailyChallengeFills: challenge.fills,
          dailyChallengeHearts: challenge.hearts,
          lastDailyChallengeDate: challenge.date,
        }));
        if (challenge.status !== "in_progress") return;
        startLevel(challenge.level, true);
        setFills(challenge.fills);
        setHearts(challenge.hearts);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o desafio.",
        );
      }
      return;
    }
    const isResume =
      progress.dailyChallengeDate === today &&
      progress.dailyChallengeStatus === "in_progress";
    setActiveChallengeDate(today);
    const puzzle = generateDailyPuzzle(today);
    startLevel(puzzle, true);
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
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = null;
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab("challenges");
    setScreen("main");
  }
  function handleCellClick(inputId) {
    if (hasChecked) return;
    const nextFill = selectedBank !== null ? selectedBank : null;
    const nextFills = { ...fills, [inputId]: nextFill };
    setFills(nextFills);
    if (selectedBank !== null) setSelectedBank(null);
    if (isChallenge) {
      setProgress((previous) => ({
        ...previous,
        dailyChallengeFills: {
          ...previous.dailyChallengeFills,
          [inputId]: nextFill,
        },
      }));
      if (authenticated) queueDailyDraft(nextFills);
    }
  }
  function handleDropNumber(inputId, number) {
    if (hasChecked || !inputIdsFor(currentLevel).includes(inputId)) return;
    const nextFills = { ...fills, [inputId]: number };
    setFills(nextFills);
    setSelectedBank(null);
    if (isChallenge) {
      setProgress((previous) => ({
        ...previous,
        dailyChallengeFills: {
          ...previous.dailyChallengeFills,
          [inputId]: number,
        },
      }));
      if (authenticated) queueDailyDraft(nextFills);
    }
  }
  function handleBankClick(number) {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  }
  async function checkAnswers() {
    if (hasChecked || !canCheck) return;
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = null;
    if (authenticated) {
      setHasChecked(true);
      setErrorMessage(null);
      const answers = Object.fromEntries(
        inputIdsFor(currentLevel).map((id) => [id, fills[id]]),
      );
      try {
        const idempotencyKey = idempotencyKeyFor(
          isChallenge,
          currentLevel.id,
          answers,
        );
        let result;
        if (isChallenge) {
          result = await api.dailyAttempt(answers, idempotencyKey);
        } else {
          result = await api.attempt(currentLevel.id, answers, idempotencyKey);
        }
        attemptRequest.current = null;
        const correct = result.correct;
        const statuses = correct
          ? Object.fromEntries(
              inputIdsFor(currentLevel).map((id) => [id, "correct"]),
            )
          : {};
        setCellStatuses(statuses);
        setIsCorrect(correct);
        setXpEarned(result.xpAwarded);
        setErrorMessage(
          correct
            ? null
            : "Ainda há uma resposta diferente. Confira as equações e tente de novo.",
        );
        setProgress((previous) => ({
          ...applyRemoteProgress(previous, result.progress),
          ...(isChallenge
            ? {
                dailyChallengeDate: today,
                dailyChallengeStatus: result.status ?? "in_progress",
                dailyChallengeFills: answers,
                dailyChallengeHearts: result.hearts ?? hearts,
                lastDailyChallengeDate: today,
              }
            : {}),
        }));
        if (correct) {
          if (!isChallenge) void refreshLevelAvailability();
          setTimeout(() => setScreen("result"), 1300);
          return;
        }
        const remainingHearts = isChallenge
          ? (result.hearts ?? hearts)
          : hearts - 1;
        setHearts(remainingHearts);
        if (remainingHearts <= 0) {
          setTimeout(() => setScreen("result"), 950);
        } else {
          setTimeout(() => {
            setCellStatuses({});
            setHasChecked(false);
            setErrorMessage(null);
          }, 1500);
        }
      } catch (error) {
        setHasChecked(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível verificar suas respostas.",
        );
      }
      return;
    }
    const answerKey = currentLevel.answers ?? {};
    const statuses = {};
    let allCorrect = true;
    for (const [id, answer] of Object.entries(answerKey)) {
      const correct = fills[id] === answer;
      statuses[id] = correct ? "correct" : "wrong";
      if (!correct) allCorrect = false;
    }
    setCellStatuses(statuses);
    setHasChecked(true);
    setIsCorrect(allCorrect);
    setXpEarned(allCorrect ? currentLevel.xpReward : 0);
    if (allCorrect) {
      setProgress((previous) => {
        const activeDate = isChallenge ? (activeChallengeDate ?? today) : today;
        const activeDateYesterday = getPreviousDateKey(activeDate);
        const nextStreak =
          previous.lastActiveDate === activeDate
            ? previous.streak
            : previous.lastActiveDate === activeDateYesterday
              ? previous.streak + 1
              : 1;
        const alreadyResolvedDailyChallenge =
          isChallenge &&
          previous.dailyChallengeDate === activeDate &&
          (previous.dailyChallengeStatus === "completed" ||
            previous.dailyChallengeStatus === "failed");
        const nextDailyStreak =
          previous.lastDailyChallengeDate === activeDate
            ? previous.currentDailyStreak
            : previous.lastDailyChallengeDate === activeDateYesterday
              ? previous.currentDailyStreak + 1
              : 1;
        return {
          ...previous,
          completedLevels: isChallenge
            ? previous.completedLevels
            : [...new Set([...previous.completedLevels, currentLevel.id])],
          totalSolved:
            previous.totalSolved + (alreadyResolvedDailyChallenge ? 0 : 1),
          totalXp:
            previous.totalXp +
            (alreadyResolvedDailyChallenge ? 0 : currentLevel.xpReward),
          streak: alreadyResolvedDailyChallenge ? previous.streak : nextStreak,
          lastActiveDate: alreadyResolvedDailyChallenge
            ? previous.lastActiveDate
            : activeDate,
          dailyChallengeDate: isChallenge
            ? activeDate
            : previous.dailyChallengeDate,
          dailyChallengeStatus: isChallenge
            ? "completed"
            : previous.dailyChallengeStatus,
          dailyChallengesCompleted:
            isChallenge && !alreadyResolvedDailyChallenge
              ? previous.dailyChallengesCompleted + 1
              : previous.dailyChallengesCompleted,
          currentDailyStreak:
            isChallenge && !alreadyResolvedDailyChallenge
              ? nextDailyStreak
              : previous.currentDailyStreak,
          bestDailyStreak:
            isChallenge && !alreadyResolvedDailyChallenge
              ? Math.max(previous.bestDailyStreak, nextDailyStreak)
              : previous.bestDailyStreak,
          lastDailyChallengeDate:
            isChallenge && !alreadyResolvedDailyChallenge
              ? activeDate
              : previous.lastDailyChallengeDate,
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
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = null;
    if (authenticated && isChallenge) saveDailyDraftNow(fills);
    const wasChallenge = isChallenge;
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab(wasChallenge ? "challenges" : "home");
    setScreen("main");
  }
  // Leaves any open puzzle without saving it, so the next person on this device starts at home.
  function resetSession() {
    if (dailyDraftTimer.current !== null)
      window.clearTimeout(dailyDraftTimer.current);
    dailyDraftTimer.current = null;
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab("home");
    setScreen("main");
  }
  function handleResultContinue() {
    setIsChallenge(false);
    setActiveChallengeDate(null);
    setActiveTab("home");
    setScreen("main");
  }
  const canCheck = inputIdsFor(currentLevel).every((id) => fills[id] != null);
  return {
    screen,
    activeTab,
    setActiveTab,
    resetSession,
    difficulty,
    setDifficulty,
    completedLevels,
    levelAvailability,
    totalXp,
    streak,
    totalSolved,
    dailyChallengeStatus,
    dailyChallengesCompleted: visibleProgress.dailyChallengesCompleted,
    currentDailyStreak,
    bestDailyStreak: visibleProgress.bestDailyStreak,
    today,
    currentLevel,
    fills,
    selectedBank,
    hearts,
    cellStatuses,
    isCorrect,
    xpEarned,
    errorMessage,
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
