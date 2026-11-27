import { useEffect, useRef, useState } from "react";
import { api } from "lib/api";
import {
  DAILY_HEARTS,
  MODE_HEARTS,
  applyDailyAnswer,
  canPlay,
  createDailyRun,
  dailyPuzzle,
  dailyXp,
} from "lib/game/dailyRun.mjs";
import { trackForStep } from "lib/game/tracks.mjs";
import { readDailyRun, saveDailyRun } from "lib/game/localDailyRun";
import { PuzzleScreen } from "components/game/PuzzleScreen";
import { playSound } from "lib/game/sound";
import { ResultScreen } from "components/game/ResultScreen";

/** Cruzadinha local `k` do dia, no formato de um nível (com as respostas). */
function localLevel(run) {
  const { step, puzzle } = dailyPuzzle(
    run.date,
    run.startStep,
    run.currentIndex,
    run.score,
  );
  return {
    id: -(Number(run.date.replaceAll("-", "")) * 1000 + run.currentIndex),
    chapter: 0,
    session: 1,
    title: "Desafio diário",
    subtitle: `Cruzadinha ${run.currentIndex + 1}`,
    emoji: "🔥",
    difficulty: trackForStep(step),
    xpReward: dailyXp(step),
    ...puzzle,
  };
}

const toSavedAnswers = (fills) =>
  Object.fromEntries(Object.entries(fills).filter(([, fill]) => fill !== null));

/**
 * Desafio diário infinito: uma cruzadinha depois da outra, ficando mais
 * difícil aos poucos, até acabarem as 3 vidas do modo. Errar mostra a resposta
 * certa; Continuar leva para a próxima (sem repetição).
 * `source` "remote" usa a API (aluno com conta); "local" guarda a rodada no
 * navegador com `storageKey` (visitante e landing page).
 */
export function DailyRunScreen({
  source,
  date,
  startStep,
  storageKey,
  dark,
  onThemeChange,
  onExit,
  backLabel = "Voltar para desafios",
  exitLabel = "Voltar para desafios",
  successDescription,
  failureDescription,
  title = "Desafio diário",
}) {
  const [run, setRun] = useState(null);
  const [level, setLevel] = useState(null);
  const [fills, setFills] = useState({});
  const [selectedBank, setSelectedBank] = useState(null);
  const [checked, setChecked] = useState(null);
  const [cellStatuses, setCellStatuses] = useState({});
  const [correctAnswers, setCorrectAnswers] = useState(null);
  const [nextRun, setNextRun] = useState(null);
  const [xpGained, setXpGained] = useState(0);
  const [solvedGained, setSolvedGained] = useState(0);
  const [lastProgress, setLastProgress] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const draftTimer = useRef(null);
  const attemptKey = useRef(null);

  const finished = run && !canPlay(run, run.date);

  async function loadRemote() {
    const challenge = await api.dailyChallenge();
    setRun({
      date: challenge.date,
      startStep: challenge.startStep,
      currentIndex: challenge.currentIndex,
      score: challenge.score,
      hearts: challenge.hearts,
      status: challenge.status,
    });
    setLevel(challenge.level);
    setFills(challenge.fills ?? {});
  }

  function showLocal(nextLocalRun, nextFills = {}) {
    setRun(nextLocalRun);
    setLevel(localLevel(nextLocalRun));
    setFills(nextFills);
    saveDailyRun(storageKey, nextLocalRun, nextFills);
  }

  useEffect(() => {
    if (source === "remote") {
      loadRemote().catch((error) => setErrorMessage(error.message));
    } else {
      const saved = readDailyRun(storageKey, date);
      if (saved) showLocal(saved.run, saved.fills);
      else showLocal(createDailyRun(date, startStep));
    }
    return () => {
      if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFills(nextFills) {
    setFills(nextFills);
    if (source === "local") {
      saveDailyRun(storageKey, run, nextFills);
      return;
    }
    if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      api.saveDailyDraft(toSavedAnswers(nextFills)).catch(() => undefined);
    }, 300);
  }

  const inputIds = level?.inputIds ?? [];
  const canCheck =
    !checked && !busy && inputIds.every((id) => fills[id] != null);

  async function check() {
    if (!canCheck) return;
    const answers = Object.fromEntries(inputIds.map((id) => [id, fills[id]]));
    let correct;
    let expected;
    let after;
    let xp;
    if (source === "remote") {
      setBusy(true);
      try {
        if (draftTimer.current !== null)
          window.clearTimeout(draftTimer.current);
        const fingerprint = JSON.stringify({ k: run.currentIndex, answers });
        if (attemptKey.current?.fingerprint !== fingerprint)
          attemptKey.current = { fingerprint, key: crypto.randomUUID() };
        const result = await api.dailyAttempt(answers, attemptKey.current.key);
        attemptKey.current = null;
        correct = result.correct;
        expected = result.correctAnswers ?? answers;
        xp = result.xpAwarded;
        after = {
          ...run,
          currentIndex: run.currentIndex + 1,
          score: result.score,
          hearts: result.hearts,
          status: result.status,
        };
        setLastProgress(result.progress);
      } catch (error) {
        setErrorMessage(error.message);
        return;
      } finally {
        setBusy(false);
      }
    } else {
      expected = level.answers;
      correct = inputIds.every((id) => fills[id] === expected[id]);
      xp = correct ? level.xpReward : 0;
      after = applyDailyAnswer(run, correct);
      saveDailyRun(storageKey, after);
    }
    setErrorMessage(null);
    setCellStatuses(
      Object.fromEntries(
        inputIds.map((id) => [
          id,
          fills[id] === expected[id] ? "correct" : "wrong",
        ]),
      ),
    );
    setCorrectAnswers(correct ? null : expected);
    setChecked(correct ? "correct" : "wrong");
    playSound(
      after.status !== "in_progress" ? "fail" : correct ? "correct" : "wrong",
    );
    setXpGained((total) => total + xp);
    setSolvedGained((total) => total + (correct ? 1 : 0));
    setRun((current) => ({ ...current, hearts: after.hearts }));
    setNextRun(after);
  }

  async function continueRun() {
    const after = nextRun;
    setChecked(null);
    setCellStatuses({});
    setCorrectAnswers(null);
    setSelectedBank(null);
    setNextRun(null);
    if (after.status !== "in_progress") {
      setRun(after);
      return;
    }
    if (source === "remote") {
      await loadRemote().catch((error) => setErrorMessage(error.message));
    } else {
      showLocal(after);
    }
  }

  const exit = () =>
    onExit({
      run: nextRun ?? run,
      xpGained,
      solvedGained,
      progress: lastProgress,
    });

  if (!run || !level) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-center text-sm font-bold text-muted-foreground">
        {errorMessage ?? "Carregando o desafio…"}
      </div>
    );
  }

  if (finished) {
    return (
      <ResultScreen
        isCorrect={run.score > 0}
        xpEarned={xpGained}
        isChallenge
        dark={dark}
        onThemeChange={onThemeChange}
        onContinue={exit}
        onRetry={exit}
        onEndChallenge={exit}
        successDescription={
          successDescription ??
          `Você acertou ${run.score} ${run.score === 1 ? "cruzadinha" : "cruzadinhas"} hoje. O próximo desafio chega amanhã.`
        }
        failureDescription={
          failureDescription ??
          `Suas ${source === "remote" ? MODE_HEARTS : DAILY_HEARTS} vidas acabaram. Elas voltam na virada do dia.`
        }
        rewardLabel="XP desta rodada"
        endChallengeLabel={exitLabel}
      />
    );
  }

  return (
    <PuzzleScreen
      level={level}
      fills={fills}
      selectedBank={selectedBank}
      hearts={run.hearts}
      cellStatuses={cellStatuses}
      hasChecked={Boolean(checked) || busy}
      canCheck={canCheck}
      isChallenge
      maxHearts={source === "remote" ? MODE_HEARTS : DAILY_HEARTS}
      badgeLabel={`${title} · ${run.score} ${run.score === 1 ? "acerto" : "acertos"}`}
      progressOverride={(run.score % 3) / 3}
      errorMessage={errorMessage}
      checkState={checked ?? "idle"}
      correctAnswers={correctAnswers}
      backLabel={backLabel}
      dark={dark}
      onThemeChange={onThemeChange}
      onCellClick={(inputId) => {
        if (checked) return;
        updateFills({ ...fills, [inputId]: selectedBank });
        setSelectedBank(null);
      }}
      onBankClick={(number) => {
        if (checked) return;
        setSelectedBank((previous) => (previous === number ? null : number));
      }}
      onDropNumber={(inputId, number) => {
        if (checked || !inputIds.includes(inputId)) return;
        updateFills({ ...fills, [inputId]: number });
        setSelectedBank(null);
      }}
      onCheck={check}
      onContinue={continueRun}
      onBack={exit}
    />
  );
}
