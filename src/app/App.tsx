import { AnimatePresence, motion } from "motion/react";
import { LEVELS } from "./data/levels";
import { MainScreen } from "./features/navigation/MainScreen";
import { PuzzleScreen } from "./features/game/components/PuzzleScreen";
import { ResultScreen } from "./features/game/components/ResultScreen";
import { useGameController } from "./features/game/useGameController";

export default function App() {
  const game = useGameController();

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {game.screen === "main" && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            <MainScreen
              activeTab={game.activeTab}
              setActiveTab={game.setActiveTab}
              levels={LEVELS}
              completedLevels={game.completedLevels}
              xp={game.totalXp}
              streak={game.streak}
              bestRound={game.bestRound}
              totalSolved={game.totalSolved}
              onStartLevel={game.startLevel}
              onStartChallenge={game.startChallenge}
            />
          </motion.div>
        )}

        {game.screen === "puzzle" && (
          <PuzzleScreen
            key="puzzle"
            level={game.currentLevel}
            fills={game.fills}
            selectedBank={game.selectedBank}
            hearts={game.hearts}
            cellStatuses={game.cellStatuses}
            hasChecked={game.hasChecked}
            canCheck={game.canCheck}
            isChallenge={game.isChallenge}
            challengeRound={game.challengeRound}
            onCellClick={game.handleCellClick}
            onBankClick={game.handleBankClick}
            onDropNumber={game.handleDropNumber}
            onCheck={game.checkAnswers}
            onBack={game.handlePuzzleBack}
          />
        )}

        {game.screen === "result" && (
          <ResultScreen
            key="result"
            level={game.currentLevel}
            isCorrect={game.isCorrect}
            xpEarned={game.isCorrect ? game.currentLevel.xpReward : 0}
            isChallenge={game.isChallenge}
            challengeRound={game.challengeRound}
            onContinue={game.handleResultContinue}
            onRetry={() => game.startLevel(game.currentLevel)}
            onNextRound={game.handleNextChallengeRound}
            onEndChallenge={game.handleEndChallenge}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
