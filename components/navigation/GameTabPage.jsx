import { useEffect } from "react";
import { MainScreen } from "components/navigation/MainScreen";
import { useNublue } from "components/providers/NublueProvider";

/** Página de uma aba do jogo (/aprender, /desafios, /ranking, /perfil, /configuracoes). */
export function GameTabPage({ tab }) {
  const nublue = useNublue();
  const { game, student } = nublue;

  // Abrir a URL direto (ou voltar no navegador) mostra a aba certa. Voltar do
  // /jogar pelo navegador fecha o puzzle como o botão "voltar" do próprio jogo.
  useEffect(() => {
    if (game.screen !== "main") game.handlePuzzleBack();
    game.setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <MainScreen
      activeTab={tab}
      setActiveTab={game.setActiveTab}
      levels={nublue.levels}
      bonusLevel={nublue.bonusLevel ?? undefined}
      completedLevels={game.completedLevels}
      levelAvailability={
        student
          ? (game.levelAvailability ?? { levels: [], bonusAvailable: false })
          : undefined
      }
      xp={game.totalXp}
      streak={game.streak}
      dailyChallengeStatus={game.dailyChallengeStatus}
      dailyChallengesCompleted={game.dailyChallengesCompleted}
      currentDailyStreak={game.currentDailyStreak}
      bestDailyStreak={game.bestDailyStreak}
      challengeDate={game.today}
      totalSolved={game.totalSolved}
      userName={nublue.userName}
      chapterId={nublue.chapterId}
      onChapterChange={nublue.changeChapter}
      onStartLevel={game.startLevel}
      onStartChallenge={game.startChallenge}
      dark={nublue.dark}
      onThemeChange={nublue.setDark}
      difficulty={game.difficulty}
      onDifficultyChange={game.setDifficulty}
      onReturnToLanding={nublue.returnToLanding}
      onDeleteAccount={student ? nublue.deleteAccount : undefined}
      leaderboardOptIn={student?.leaderboardOptIn ?? false}
      onLeaderboardOptInChange={nublue.setLeaderboardOptIn}
      lives={game.lives}
      isChallengeMode={Boolean(student)}
      challengeInfo={student ? game.challengeInfo : null}
      clock={game.clock}
    />
  );
}
