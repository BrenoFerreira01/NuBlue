import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LEVELS } from "./data/levels";
import { LandingPage } from "./features/landing/LandingPage";
import { DiagnosticTest } from "./features/onboarding/DiagnosticTest";
import { MainScreen } from "./features/navigation/MainScreen";
import { PuzzleScreen } from "./features/game/components/PuzzleScreen";
import { ResultScreen } from "./features/game/components/ResultScreen";
import { useGameController } from "./features/game/useGameController";

export default function App() {
  const game = useGameController();
  const [view, setView] = useState<"landing" | "diagnostic" | "game">("landing");
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("nublue-theme") === "dark";
  });
  const [userName, setUserName] = useState(() => {
    if (typeof window === "undefined") return "Jogador";
    return window.localStorage.getItem("nublue-user-name")?.trim() || "Jogador";
  });
  const [chapterId, setChapterId] = useState(() => {
    if (typeof window === "undefined") return 1;
    const savedChapter = Number(window.localStorage.getItem("nublue-chapter"));
    return Number.isInteger(savedChapter) && savedChapter >= 1 && savedChapter <= 5 ? savedChapter : 1;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("nublue-theme", dark ? "dark" : "light");
  }, [dark]);

  const enterGame = () => {
    game.setActiveTab("home");
    setView("game");
  };

  const startDiagnostic = (name: string) => {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (normalizedName) {
      setUserName(normalizedName);
      window.localStorage.setItem("nublue-user-name", normalizedName);
    }
    setView("diagnostic");
  };

  const changeChapter = (nextChapter: number) => {
    setChapterId(nextChapter);
    window.localStorage.setItem("nublue-chapter", String(nextChapter));
  };

  const finishDiagnostic = (difficulty: typeof game.difficulty) => {
    game.setDifficulty(difficulty);
    game.setActiveTab("home");
    setView("game");
  };

  const skipDiagnostic = () => {
    changeChapter(1);
    finishDiagnostic("easy");
  };

  const returnToLanding = () => {
    game.setActiveTab("home");
    setView("landing");
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <AnimatePresence mode="wait">
        {view === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            <LandingPage
              dark={dark}
              onThemeChange={setDark}
              onLogin={enterGame}
              onSignup={startDiagnostic}
              dailyChallengeDate={game.today}
            />
          </motion.div>
        )}

        {view === "diagnostic" && (
          <motion.div
            key="diagnostic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen"
          >
            <DiagnosticTest
              dark={dark}
              onThemeChange={setDark}
              onBack={() => setView("landing")}
              onSkip={skipDiagnostic}
              onFinish={finishDiagnostic}
            />
          </motion.div>
        )}

        {view === "game" && game.screen === "main" && (
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
              dailyChallengeStatus={game.dailyChallengeStatus}
              dailyChallengesCompleted={game.dailyChallengesCompleted}
              currentDailyStreak={game.currentDailyStreak}
              bestDailyStreak={game.bestDailyStreak}
              challengeDate={game.today}
              totalSolved={game.totalSolved}
              userName={userName}
              chapterId={chapterId}
              onChapterChange={changeChapter}
              onStartLevel={game.startLevel}
              onStartChallenge={game.startChallenge}
              dark={dark}
              onThemeChange={setDark}
              difficulty={game.difficulty}
              onDifficultyChange={game.setDifficulty}
              onReturnToLanding={returnToLanding}
            />
          </motion.div>
        )}

        {view === "game" && game.screen === "puzzle" && (
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
            dark={dark}
            onThemeChange={setDark}
            onCellClick={game.handleCellClick}
            onBankClick={game.handleBankClick}
            onDropNumber={game.handleDropNumber}
            onCheck={game.checkAnswers}
            onBack={game.handlePuzzleBack}
          />
        )}

        {view === "game" && game.screen === "result" && (
          <ResultScreen
            key="result"
            isCorrect={game.isCorrect}
            xpEarned={game.isCorrect ? game.currentLevel.xpReward : 0}
            isChallenge={game.isChallenge}
            dark={dark}
            onThemeChange={setDark}
            onContinue={game.handleResultContinue}
            onRetry={() => game.startLevel(game.currentLevel)}
            onEndChallenge={game.handleEndChallenge}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
