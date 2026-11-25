import { useEffect, useRef, useState } from "react";
import { generateLandingDailyPuzzle } from "lib/game/generatePuzzle";
import { PuzzleScreen } from "components/game/PuzzleScreen";
import { ResultScreen } from "components/game/ResultScreen";
import {
  readLandingDailyProgress,
  saveLandingDailyProgress,
} from "lib/game/landingDailyProgress";
export function LandingDailyChallenge({
  challengeDate,
  dark,
  onThemeChange,
  onClose,
  onComplete,
}) {
  const [level] = useState(() => generateLandingDailyPuzzle(challengeDate));
  const [initialProgress] = useState(() =>
    readLandingDailyProgress(challengeDate),
  );
  const [screen, setScreen] = useState("puzzle");
  const [fills, setFills] = useState(() => initialProgress?.fills ?? {});
  const [selectedBank, setSelectedBank] = useState(null);
  const [hearts, setHearts] = useState(() => initialProgress?.hearts ?? 3);
  const [cellStatuses, setCellStatuses] = useState({});
  const [hasChecked, setHasChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const resultTimeout = useRef(null);
  const retryTimeout = useRef(null);
  const answerKey = level.answers ?? {};
  const canCheck = Object.keys(answerKey).every((id) => fills[id] != null);
  useEffect(
    () => () => {
      if (resultTimeout.current !== null)
        window.clearTimeout(resultTimeout.current);
      if (retryTimeout.current !== null)
        window.clearTimeout(retryTimeout.current);
    },
    [],
  );
  useEffect(() => {
    const status =
      screen === "result"
        ? isCorrect
          ? "completed"
          : "failed"
        : hasChecked && isCorrect
          ? "completed"
          : hearts <= 0
            ? "failed"
            : "in_progress";
    saveLandingDailyProgress({
      date: challengeDate,
      status,
      fills,
      hearts,
    });
  }, [challengeDate, fills, hearts, hasChecked, isCorrect, screen]);
  const handleCellClick = (inputId) => {
    if (hasChecked) return;
    setFills((previous) => ({ ...previous, [inputId]: selectedBank }));
    setSelectedBank(null);
  };
  const handleDropNumber = (inputId, number) => {
    if (hasChecked || !(inputId in answerKey)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
  };
  const handleBankClick = (number) => {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  };
  const checkAnswers = () => {
    if (hasChecked || !canCheck || hearts <= 0) return;
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
    if (allCorrect) {
      resultTimeout.current = window.setTimeout(() => setScreen("result"), 900);
      return;
    }
    const remainingHearts = hearts - 1;
    setHearts(remainingHearts);
    if (remainingHearts <= 0) {
      resultTimeout.current = window.setTimeout(() => setScreen("result"), 900);
      return;
    }
    retryTimeout.current = window.setTimeout(() => {
      setCellStatuses({});
      setHasChecked(false);
    }, 1_500);
  };
  const finishChallenge = () => onComplete(isCorrect);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {screen === "puzzle" ? (
        <PuzzleScreen
          level={level}
          fills={fills}
          selectedBank={selectedBank}
          hearts={hearts}
          cellStatuses={cellStatuses}
          hasChecked={hasChecked}
          canCheck={canCheck}
          isChallenge={false}
          showLevelMeta={false}
          backLabel="Voltar para a landing page"
          dark={dark}
          onThemeChange={onThemeChange}
          onCellClick={handleCellClick}
          onBankClick={handleBankClick}
          onDropNumber={handleDropNumber}
          onCheck={checkAnswers}
          onBack={onClose}
        />
      ) : (
        <ResultScreen
          isCorrect={isCorrect}
          xpEarned={isCorrect ? level.xpReward : 0}
          isChallenge
          dark={dark}
          onThemeChange={onThemeChange}
          onContinue={finishChallenge}
          onRetry={() => setScreen("puzzle")}
          onEndChallenge={finishChallenge}
          successDescription="Seu desafio de hoje foi concluído. A recompensa fica nesta experiência e não é vinculada a um perfil."
          failureDescription="Suas tentativas terminaram. Um novo desafio fica disponível amanhã."
          rewardLabel="Recompensa do desafio"
          endChallengeLabel="Voltar para a landing page"
        />
      )}
    </div>
  );
}
