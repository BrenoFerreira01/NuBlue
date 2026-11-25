import { useEffect } from "react";
import { useRouter } from "next/router";
import { PuzzleScreen } from "components/game/PuzzleScreen";
import { ResultScreen } from "components/game/ResultScreen";
import { useNublue } from "components/providers/NublueProvider";
import { TAB_PATHS } from "lib/routes";

export default function Jogar() {
  const router = useRouter();
  const { game, dark, setDark } = useNublue();

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
        isChallenge={game.isChallenge}
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

  if (game.screen === "result") {
    return (
      <ResultScreen
        isCorrect={game.isCorrect}
        xpEarned={game.isCorrect ? game.xpEarned : 0}
        isChallenge={game.isChallenge}
        dark={dark}
        onThemeChange={setDark}
        onContinue={game.handleResultContinue}
        onRetry={() => game.startLevel(game.currentLevel)}
        onEndChallenge={game.handleEndChallenge}
      />
    );
  }

  return null;
}
