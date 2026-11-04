import { AnimatePresence, motion } from "motion/react";
import { Flame, Home as HomeIcon, Settings, Swords, Trophy, User, Zap } from "lucide-react";
import { clsx } from "clsx";
import type { Difficulty, Level, TabId } from "../../types/game";
import { Brand } from "../../components/Brand";
import { ThemeToggle } from "../../components/ThemeToggle";
import { SkillPathTab } from "../learning/SkillPathTab";
import { ChallengesTab } from "../challenges/ChallengesTab";
import { RankingTab } from "../ranking/RankingTab";
import { ProfileTab } from "../profile/ProfileTab";
import { SettingsTab } from "../settings/SettingsTab";
import type { DailyChallengeStatus } from "../challenges/dailyChallenge";

const NAV_ITEMS: { id: TabId; Icon: typeof HomeIcon; label: string }[] = [
  { id: "home", Icon: HomeIcon, label: "Aprender" },
  { id: "challenges", Icon: Swords, label: "Desafio" },
  { id: "ranking", Icon: Trophy, label: "Ranking" },
  { id: "profile", Icon: User, label: "Perfil" },
  { id: "settings", Icon: Settings, label: "Ajustes" },
];

export function MainScreen({
  activeTab,
  setActiveTab,
  levels,
  completedLevels,
  xp,
  streak,
  dailyChallengeStatus,
  dailyChallengesCompleted,
  currentDailyStreak,
  bestDailyStreak,
  challengeDate,
  totalSolved,
  userName,
  chapterId,
  onChapterChange,
  onStartLevel,
  onStartChallenge,
  dark,
  onThemeChange,
  difficulty,
  onDifficultyChange,
  onReturnToLanding,
}: {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  levels: Level[];
  completedLevels: number[];
  xp: number;
  streak: number;
  dailyChallengeStatus: DailyChallengeStatus | null;
  dailyChallengesCompleted: number;
  currentDailyStreak: number;
  bestDailyStreak: number;
  challengeDate: string;
  totalSolved: number;
  userName: string;
  chapterId: number;
  onChapterChange: (chapterId: number) => void;
  onStartLevel: (level: Level) => void;
  onStartChallenge: () => void;
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onReturnToLanding: () => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "var(--glow-brand)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 py-3 backdrop-blur-xl sm:px-5 md:px-8 md:py-4 dark:border-[#1e1254] dark:bg-[#09031f] dark:backdrop-blur-none">
          <div className="min-w-0 shrink-0">
            <div className="sm:hidden"><Brand compact /></div>
            <div className="hidden sm:block"><Brand /></div>
          </div>
          <div className="hidden min-w-0 flex-1 px-4 md:block">
            <p className="truncate text-sm font-black text-muted-foreground">Olá, {userName}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1.5 text-xs font-black sm:gap-1.5 sm:px-3 sm:text-sm">
              <Flame size={14} className="shrink-0 fill-orange-400 text-orange-400" />
              <span>{streak}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1.5 text-xs font-black sm:gap-1.5 sm:px-3 sm:text-sm">
              <Zap size={14} className="shrink-0 fill-yellow-400 text-yellow-400" />
              <span>{xp.toLocaleString("pt-BR")} XP</span>
            </div>
            <ThemeToggle dark={dark} onToggle={() => onThemeChange(!dark)} />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <SkillPathTab
                  levels={levels}
                  completedLevels={completedLevels}
                  chapterId={chapterId}
                  onChapterChange={onChapterChange}
                  onStartLevel={onStartLevel}
                />
              </motion.div>
            )}
            {activeTab === "challenges" && (
              <motion.div
                key="challenges"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <ChallengesTab
                  challengeDate={challengeDate}
                  dark={dark}
                  status={dailyChallengeStatus}
                  completedCount={dailyChallengesCompleted}
                  currentStreak={currentDailyStreak}
                  bestStreak={bestDailyStreak}
                  onStartChallenge={onStartChallenge}
                />
              </motion.div>
            )}
            {activeTab === "ranking" && (
              <motion.div
                key="ranking"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <RankingTab userName={userName} userXp={xp} userStreak={streak} />
              </motion.div>
            )}
            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <ProfileTab
                  userName={userName}
                  xp={xp}
                  streak={streak}
                  completedLevels={completedLevels}
                  dailyChallengesCompleted={dailyChallengesCompleted}
                  bestDailyStreak={bestDailyStreak}
                  totalSolved={totalSolved}
                />
              </motion.div>
            )}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <SettingsTab
                  difficulty={difficulty}
                  onDifficultyChange={onDifficultyChange}
                  onReturnToLanding={onReturnToLanding}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="relative z-10 flex border-t border-secondary bg-card pb-[env(safe-area-inset-bottom)] dark:border-[#1a1050] dark:bg-[#0a0428]"
      >
        {NAV_ITEMS.map(({ id, Icon, label }) => (
          <NavButton
            key={id}
            active={activeTab === id}
            onClick={() => setActiveTab(id)}
            Icon={Icon}
            label={label}
          />
        ))}
      </nav>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof HomeIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "text-primary dark:text-[#c080ff]"
          : "text-muted-foreground hover:text-foreground dark:text-[#3a2a70] dark:hover:text-[#c080ff]",
      )}
    >
      <Icon size={22} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
