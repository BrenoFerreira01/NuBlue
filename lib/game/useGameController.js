import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "lib/api";
import { LEVELS } from "lib/game/levels";
import { canPlay } from "lib/game/dailyRun.mjs";
import { readDailyRun } from "lib/game/localDailyRun";
import { getLocalDateKey, getPreviousDateKey } from "lib/game/dailyChallenge";
import {
  answerLesson,
  continueLesson,
  createLesson,
  LESSON_PUZZLES,
} from "lib/game/lesson";
import { levelForDifficulty } from "lib/game/lessonLevel";
import { newlyUnlocked, unlockedIds } from "lib/game/achievements";
import { playSound } from "lib/game/sound";
import {
  LIFE_REGEN_MS,
  MAX_LIVES,
  fullLives,
  livesAt,
  spendLife,
} from "lib/game/lives.mjs";
const PROGRESS_STORAGE_KEY = "nublue-game-progress";
export const GUEST_DAILY_STORAGE_KEY = "nublue-daily-run";
const DIFFICULTY_STORAGE_KEY = "nublue-difficulty";
const LIVES_STORAGE_KEY = "nublue-lives";

/** Vidas do visitante guardadas no navegador ({ lives, updatedAt }). */
function readStoredLives() {
  if (typeof window === "undefined") return fullLives(Date.now());
  try {
    const value = JSON.parse(window.localStorage.getItem(LIVES_STORAGE_KEY));
    if (
      Number.isInteger(value?.lives) &&
      value.lives >= 0 &&
      value.lives <= MAX_LIVES &&
      Number.isFinite(value.updatedAt)
    )
      return { lives: value.lives, updatedAt: value.updatedAt };
  } catch {
    // Sem dados válidos: vidas cheias.
  }
  return fullLives(Date.now());
}

/** Vidas no formato da API ({ lives, nextLifeAt }) viram o estado local. */
function livesFromServer({ lives, nextLifeAt }) {
  return {
    lives,
    updatedAt: nextLifeAt ? Date.parse(nextLifeAt) - LIFE_REGEN_MS : Date.now(),
  };
}
const DIFFICULTIES = ["easy", "medium", "hard"];

/** Dificuldade geral do visitante, guardada no navegador (padrão: medium). */
function readStoredDifficulty() {
  if (typeof window === "undefined") return "medium";
  try {
    const stored = window.localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    return DIFFICULTIES.includes(stored) ? stored : "medium";
  } catch {
    return "medium";
  }
}
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
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}
function inputIdsFor(level) {
  return level.inputIds ?? Object.keys(level.answers ?? {});
}
/** Cruzadinha `index` da lição, com os metadados do nível. */
function lessonPuzzle(lessonLevel, index) {
  const { puzzles, ...metadata } = lessonLevel;
  return { ...metadata, ...puzzles[index], puzzleIndex: index };
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
export function useGameController({
  levels = LEVELS,
  authenticated = false,
  studentDifficulty,
  userKey = "guest",
} = {}) {
  const [screen, setScreen] = useState("main");
  const [activeTab, setActiveTab] = useState("home");
  const [difficulty, setDifficulty] = useState(readStoredDifficulty);
  // Com conta, a dificuldade vem do servidor; sem conta, do navegador.
  useEffect(() => {
    setDifficulty(
      authenticated && DIFFICULTIES.includes(studentDifficulty)
        ? studentDifficulty
        : readStoredDifficulty(),
    );
  }, [authenticated, studentDifficulty]);
  /** Troca a dificuldade geral e a guarda (servidor ou navegador). */
  function changeDifficulty(next) {
    if (!DIFFICULTIES.includes(next)) return;
    setDifficulty(next);
    if (authenticated) {
      api.setDifficulty(next).catch(() => undefined);
      return;
    }
    try {
      window.localStorage.setItem(DIFFICULTY_STORAGE_KEY, next);
    } catch {
      // Vale só nesta visita quando o armazenamento está indisponível.
    }
  }
  const [progress, setProgress] = useState(readSavedProgress);
  const [remoteProgressReady, setRemoteProgressReady] = useState(false);
  const [levelAvailability, setLevelAvailability] = useState(null);
  const availabilityRequest = useRef(0);
  const visibleProgress =
    authenticated && !remoteProgressReady ? EMPTY_PROGRESS : progress;
  const { completedLevels, totalXp, streak, totalSolved } = visibleProgress;
  const [today, setToday] = useState(getLocalDateKey);
  // Última rodada conhecida do desafio (data e situação), para o aviso de reset.
  const lastRunRef = useRef(null);
  lastRunRef.current = {
    date: visibleProgress.dailyChallengeDate,
    status: visibleProgress.dailyChallengeStatus,
  };
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
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  // Lição em andamento (fila de 4 cruzadinhas) e a resposta certa revelada.
  const [lessonSource, setLessonSource] = useState(null);
  const [lessonLevel, setLessonLevel] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [correctAnswers, setCorrectAnswers] = useState(null);
  const [lessonXp, setLessonXp] = useState(0);
  // Vidas das lições: 5, e cada uma volta 15 minutos depois. O relógio
  // atualiza o cronômetro e devolve as vidas sem precisar do servidor.
  const [livesState, setLivesState] = useState(readStoredLives);
  const [clock, setClock] = useState(() => Date.now());
  const livesView = livesAt(livesState, clock);
  const lifeIsRegenerating = livesView.nextLifeAt !== null;
  useEffect(() => {
    if (!lifeIsRegenerating) return undefined;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lifeIsRegenerating]);
  useEffect(() => {
    if (authenticated) return;
    try {
      window.localStorage.setItem(
        LIVES_STORAGE_KEY,
        JSON.stringify(livesState),
      );
    } catch {
      // As vidas valem só nesta visita sem armazenamento.
    }
  }, [livesState, authenticated]);
  // Modo Desafio (com conta): vidas da rodada e quando elas voltam.
  const [challengeInfo, setChallengeInfo] = useState(null);
  // Avisos no topo da tela (vidas restauradas, conquistas…).
  const [notices, setNotices] = useState([]);
  const notify = useCallback((notice) => {
    if (notice.kind === "achievement") playSound("achievement");
    else if (notice.kind === "lives" || notice.kind === "challenge-reset")
      playSound("lives");
    const id = crypto.randomUUID();
    setNotices((current) => [...current, { id, ...notice }]);
    window.setTimeout(
      () => setNotices((current) => current.filter((n) => n.id !== id)),
      4500,
    );
  }, []);
  const dismissNotice = (id) =>
    setNotices((current) => current.filter((n) => n.id !== id));
  // Na virada do dia, o desafio encerrado volta com as vidas cheias.
  const previousDay = useRef(today);
  useEffect(() => {
    const lastRun = lastRunRef.current;
    if (
      previousDay.current !== today &&
      lastRun?.date === previousDay.current &&
      (lastRun.status === "completed" || lastRun.status === "failed")
    )
      notify({
        kind: "challenge-reset",
        title: authenticated
          ? "Modo Desafio liberado!"
          : "Novo desafio diário!",
        text: "Suas vidas do desafio voltaram.",
      });
    previousDay.current = today;
  }, [today, authenticated, notify]);
  const previousLives = useRef(livesView.lives);
  useEffect(() => {
    if (previousLives.current < MAX_LIVES && livesView.lives === MAX_LIVES)
      notify({
        kind: "lives",
        title: "Vidas restauradas!",
        text: `Você tem ${MAX_LIVES} vidas de novo.`,
      });
    previousLives.current = livesView.lives;
  }, [livesView.lives, notify]);
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
  function idempotencyKeyFor(levelId, answers) {
    const fingerprint = JSON.stringify({
      levelId,
      lessonId,
      puzzleIndex: lesson?.queue[0],
      answers,
    });
    if (attemptRequest.current?.fingerprint === fingerprint) {
      return attemptRequest.current.idempotencyKey;
    }
    const idempotencyKey = crypto.randomUUID();
    attemptRequest.current = { fingerprint, idempotencyKey };
    return idempotencyKey;
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
      .me()
      .then(({ progress: remote, lives: remoteLives }) => {
        if (!active) return;
        setProgress(() => applyRemoteProgress(EMPTY_PROGRESS, remote));
        if (remoteLives) {
          const state = livesFromServer(remoteLives);
          previousLives.current = livesAt(state, Date.now()).lives;
          setLivesState(state);
          setClock(Date.now());
        }
        setRemoteProgressReady(true);
      })
      .catch(() => undefined);
    void refreshLevelAvailability();
    api
      .dailyChallenge()
      .then((challenge) => {
        if (!active) return;
        setToday(challenge.date);
        setChallengeInfo({
          hearts: challenge.hearts,
          resetsAt: Date.parse(challenge.resetsAt),
        });
        setProgress((current) => ({
          ...current,
          dailyChallengeDate: challenge.date,
          dailyChallengeStatus: challenge.status,
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
  function resetPuzzleState() {
    setFills({});
    setSelectedBank(null);
    setCellStatuses({});
    setCorrectAnswers(null);
    setHasChecked(false);
    setErrorMessage(null);
  }
  function startLevel(level) {
    const available = livesAt(livesState, Date.now()).lives;
    if (available <= 0) {
      notify({
        kind: "no-lives",
        title: "Sem vidas",
        text: "Uma nova vida volta em até 15 minutos.",
      });
      return;
    }
    const view = levelForDifficulty(level, difficulty, {
      guest: !authenticated,
    });
    const next = createLesson(view.track, available);
    setLessonSource(level);
    setLessonLevel(view);
    setLesson(next);
    setLessonId(crypto.randomUUID());
    setCurrentLevel(lessonPuzzle(view, next.queue[0]));
    resetPuzzleState();
    setHearts(next.hearts);
    setIsCorrect(false);
    setXpEarned(0);
    setLessonXp(0);
    setScreen("puzzle");
  }
  function retryLevel() {
    if (lessonSource) startLevel(lessonSource);
  }
  /** Abre o desafio diário infinito (ele mesmo carrega e guarda a rodada). */
  function startChallenge() {
    if (
      !authenticated &&
      !canPlay(readDailyRun(GUEST_DAILY_STORAGE_KEY, today)?.run, today)
    )
      return;
    setScreen("daily");
  }
  /** Saída do desafio: atualiza o progresso e volta para a aba Desafio. */
  function handleEndChallenge(summary) {
    const run = summary?.run;
    if (run && authenticated)
      setChallengeInfo((current) =>
        current ? { ...current, hearts: run.hearts } : current,
      );
    if (run) {
      setProgress((previous) => {
        const next = {
          ...(summary.progress
            ? applyRemoteProgress(previous, summary.progress)
            : previous),
          dailyChallengeDate: run.date,
          dailyChallengeStatus: run.status,
        };
        if (authenticated) return next;
        // Visitante: o dia conta para a sequência a partir do primeiro acerto.
        const counted = previous.lastDailyChallengeDate === run.date;
        const yesterday = getPreviousDateKey(run.date);
        const dailyStreak =
          previous.lastDailyChallengeDate === yesterday
            ? previous.currentDailyStreak + 1
            : 1;
        return {
          ...next,
          totalXp: previous.totalXp + summary.xpGained,
          totalSolved: previous.totalSolved + summary.solvedGained,
          ...(run.score > 0 && !counted
            ? {
                dailyChallengesCompleted: previous.dailyChallengesCompleted + 1,
                currentDailyStreak: dailyStreak,
                bestDailyStreak: Math.max(
                  previous.bestDailyStreak,
                  dailyStreak,
                ),
                lastDailyChallengeDate: run.date,
              }
            : {}),
          ...(run.status === "failed" ? { currentDailyStreak: 0 } : {}),
        };
      });
    }
    setActiveTab("challenges");
    setScreen("main");
  }
  /**
   * Aplica o nivelamento: grava a dificuldade e marca como concluídos (sem XP)
   * os níveis dos capítulos anteriores ao indicado.
   */
  function applyPlacement({ chapter, difficulty: placed }) {
    if (authenticated) {
      setDifficulty(placed);
      api
        .placement(chapter, placed)
        .then((result) => {
          setProgress((previous) =>
            applyRemoteProgress(previous, result.progress),
          );
          void refreshLevelAvailability();
        })
        .catch(() => undefined);
      return;
    }
    changeDifficulty(placed);
    const earlier = levels
      .filter((level) => !level.isBonus && level.chapter < chapter)
      .map((level) => level.id);
    setProgress((previous) => ({
      ...previous,
      completedLevels: [...new Set([...previous.completedLevels, ...earlier])],
    }));
  }
  function handleCellClick(inputId) {
    if (hasChecked) return;
    setFills({ ...fills, [inputId]: selectedBank });
    if (selectedBank !== null) setSelectedBank(null);
  }
  function handleDropNumber(inputId, number) {
    if (hasChecked || !inputIdsFor(currentLevel).includes(inputId)) return;
    setFills({ ...fills, [inputId]: number });
    setSelectedBank(null);
  }
  function handleBankClick(number) {
    if (hasChecked) return;
    playSound("tap");
    setSelectedBank((previous) => (previous === number ? null : number));
  }
  /** Corrige a cruzadinha atual da lição; quem avança é o botão Continuar. */
  async function checkAnswers() {
    if (hasChecked || !canCheck || !lesson) return;
    const ids = inputIdsFor(currentLevel);
    const answers = Object.fromEntries(ids.map((id) => [id, fills[id]]));
    let correct;
    let expected;
    setHasChecked(true);
    setErrorMessage(null);
    if (authenticated) {
      try {
        const result = await api.attempt(
          currentLevel.id,
          answers,
          idempotencyKeyFor(currentLevel.id, answers),
          {
            difficulty: lesson.difficulty,
            puzzleIndex: currentLevel.puzzleIndex,
            lessonId,
          },
        );
        attemptRequest.current = null;
        correct = result.correct;
        expected = result.correctAnswers ?? answers;
        if (result.lives) {
          setLivesState(livesFromServer(result.lives));
          setClock(Date.now());
        }
        setProgress((previous) =>
          applyRemoteProgress(previous, result.progress),
        );
        if (result.lessonCompleted) {
          setLessonXp(result.xpAwarded);
          void refreshLevelAvailability();
        }
      } catch (error) {
        setHasChecked(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível verificar suas respostas.",
        );
        return;
      }
    } else {
      expected = currentLevel.answers ?? {};
      correct = ids.every((id) => fills[id] === expected[id]);
      if (!correct) {
        const now = Date.now();
        setLivesState((current) => spendLife(current, now) ?? current);
        setClock(now);
      }
    }
    setCellStatuses(
      Object.fromEntries(
        ids.map((id) => [id, fills[id] === expected[id] ? "correct" : "wrong"]),
      ),
    );
    setCorrectAnswers(correct ? null : expected);
    playSound(correct ? "correct" : "wrong");
    const next = answerLesson(lesson, correct);
    setLesson(next);
    setHearts(next.hearts);
  }
  /** Botão Continuar da lição: próxima cruzadinha, revisão ou resultado. */
  function continueAfterCheck() {
    if (!lesson?.checked) return;
    if (lesson.failed) {
      playSound("fail");
      setIsCorrect(false);
      setXpEarned(0);
      setScreen("result");
      return;
    }
    const next = continueLesson(lesson);
    setLesson(next);
    if (next.done) {
      finishLesson();
      return;
    }
    setCurrentLevel(lessonPuzzle(lessonLevel, next.queue[0]));
    resetPuzzleState();
  }
  function finishLesson() {
    playSound("complete");
    setIsCorrect(true);
    if (authenticated) {
      setXpEarned(lessonXp);
      setScreen("result");
      return;
    }
    const alreadyCompleted = progress.completedLevels.includes(lessonLevel.id);
    const xp = alreadyCompleted ? 0 : lessonLevel.xpReward;
    setXpEarned(xp);
    setProgress((previous) => {
      let nextStreak = 1;
      if (previous.lastActiveDate === today) nextStreak = previous.streak;
      else if (previous.lastActiveDate === getPreviousDateKey(today))
        nextStreak = previous.streak + 1;
      return {
        ...previous,
        completedLevels: [
          ...new Set([...previous.completedLevels, lessonLevel.id]),
        ],
        totalSolved: previous.totalSolved + 1,
        totalXp: previous.totalXp + xp,
        streak: nextStreak,
        lastActiveDate: today,
      };
    });
    setScreen("result");
  }
  // Leaves any open puzzle without saving it, so the next person on this device starts at home.
  function goHome() {
    setActiveTab("home");
    setScreen("main");
  }
  // Conquistas: avisa no topo quando uma nova é desbloqueada. As já vistas
  // ficam no navegador, por conta; na primeira vez são só registradas.
  const achievementStats = {
    completedLevels,
    totalLevels: levels.filter((level) => !level.isBonus).length,
    xp: totalXp,
    streak,
    dailyChallengesCompleted: visibleProgress.dailyChallengesCompleted,
    bestDailyStreak: visibleProgress.bestDailyStreak,
  };
  const unlockedKey = unlockedIds(achievementStats).join(",");
  const progressReady = !authenticated || remoteProgressReady;
  useEffect(() => {
    if (!progressReady) return;
    const storageKey = `nublue-achievements-${userKey}`;
    const unlocked = unlockedKey ? unlockedKey.split(",") : [];
    let seen = null;
    try {
      seen = JSON.parse(window.localStorage.getItem(storageKey));
    } catch {
      seen = null;
    }
    if (Array.isArray(seen)) {
      for (const achievement of newlyUnlocked(seen, unlocked))
        notify({
          kind: "achievement",
          emoji: achievement.emoji,
          title: `Conquista desbloqueada: ${achievement.name}`,
          text: achievement.desc(achievementStats),
        });
    }
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify([...new Set([...(seen ?? []), ...unlocked])]),
      );
    } catch {
      // Sem armazenamento, os avisos valem só nesta visita.
    }
    // achievementStats muda a cada render; unlockedKey resume o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey, userKey, progressReady, notify]);
  const canCheck = inputIdsFor(currentLevel).every((id) => fills[id] != null);
  const lessonProgress = lesson
    ? (LESSON_PUZZLES -
        lesson.queue.length +
        (lesson.checked === "correct" ? 1 : 0)) /
      LESSON_PUZZLES
    : null;
  return {
    challengeInfo,
    lives: {
      lives: livesView.lives,
      max: MAX_LIVES,
      nextLifeAt: livesView.nextLifeAt,
    },
    clock,
    notices,
    notify,
    dismissNotice,
    lesson,
    lessonProgress,
    correctAnswers,
    continueAfterCheck,
    retryLevel,
    screen,
    activeTab,
    setActiveTab,
    resetSession: goHome,
    difficulty,
    setDifficulty: changeDifficulty,
    applyPlacement,
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
    canCheck,
    startLevel,
    startChallenge,
    handleEndChallenge,
    handleCellClick,
    handleDropNumber,
    handleBankClick,
    checkAnswers,
    handlePuzzleBack: goHome,
    handleResultContinue: goHome,
  };
}
