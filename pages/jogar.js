import { useEffect } from "react";
import { useRouter } from "next/router";
import { PuzzleScreen } from "components/game/PuzzleScreen";
import { ResultScreen } from "components/game/ResultScreen";
import { DailyRunScreen } from "components/challenges/DailyRunScreen";
import { GUEST_DAILY_STORAGE_KEY } from "lib/game/useGameController";
import { DAILY_START_STEP } from "lib/game/tracks.mjs";
import { useNublue } from "components/providers/NublueProvider";
import { TAB_PATHS } from "lib/routes";

export default function Jogar() {
  const router = useRouter();
  const { game, dark, setDark, student } = useNublue();

  // Sem puzzle em andamento (ex.: recarregou a página): volta para a aba atual.
  useEffect(() => {
    if (game.screen === "main") router.replace(TAB_PATHS[game.activeTab]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.screen]);

  if (game.screen === "puzzle") {
    return (
      <PuzzleScreen
        level={game.currentLevel}
        fills={game.fills}
        selectedBank={game.selectedBank}
        hearts={game.hearts}
        cellStatuses={game.cellStatuses}
        hasChecked={game.hasChecked}
        canCheck={game.canCheck}
        errorMessage={game.errorMessage}
        isChallenge={false}
        checkState={game.lesson?.checked ?? "idle"}
        correctAnswers={game.correctAnswers}
        notice={
          game.lesson?.reviewing && !game.lesson.checked
            ? "Vamos rever o que você errou"
            : undefined
        }
        progressOverride={game.lessonProgress ?? undefined}
        onContinue={game.continueAfterCheck}
        dark={dark}
        onThemeChange={setDark}
        onCellClick={game.handleCellClick}
        onBankClick={game.handleBankClick}
        onDropNumber={game.handleDropNumber}
        onCheck={game.checkAnswers}
        onBack={game.handlePuzzleBack}
      />
    );
  }

  if (game.screen === "daily") {
    return (
      <DailyRunScreen
        source={student ? "remote" : "local"}
        date={game.today}
        startStep={DAILY_START_STEP[game.difficulty] ?? DAILY_START_STEP.medium}
        storageKey={GUEST_DAILY_STORAGE_KEY}
        dark={dark}
        onThemeChange={setDark}
        onExit={game.handleEndChallenge}
      />
    );
  }

  if (game.screen === "result") {
    return (
      <ResultScreen
        isCorrect={game.isCorrect}
        xpEarned={game.isCorrect ? game.xpEarned : 0}
        isChallenge={false}
        dark={dark}
        onThemeChange={setDark}
        onContinue={game.handleResultContinue}
        onRetry={game.retryLevel}
        onEndChallenge={game.handleEndChallenge}
      />
    );
  }

  return null;
}
