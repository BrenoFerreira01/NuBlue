import { AnimatePresence, motion } from "motion/react";
import { Flame, Home as HomeIcon, Swords, Trophy, User, Zap } from "lucide-react";
import { clsx } from "clsx";
import type { Level, TabId } from "../../types/game";
import { SkillPathTab } from "../learning/SkillPathTab";
import { ChallengesTab } from "../challenges/ChallengesTab";
import { RankingTab } from "../ranking/RankingTab";
import { ProfileTab } from "../profile/ProfileTab";

export function MainScreen({
  activeTab, setActiveTab, levels, completedLevels, xp, streak,
  bestRound, totalSolved, onStartLevel, onStartChallenge,
}: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  levels: Level[];
  completedLevels: number[];
  xp: number;
  streak: number;
  bestRound: number;
  totalSolved: number;
  onStartLevel: (l: Level) => void;
  onStartChallenge: () => void;
}) {
  const navItems: { id: TabId; Icon: typeof HomeIcon; label: string }[] = [
    { id: "home", Icon: HomeIcon, label: "Aprender" },
    { id: "challenges", Icon: Swords, label: "Desafio" },
    { id: "ranking", Icon: Trophy, label: "Ranking" },
    { id: "profile", Icon: User, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "var(--glow-brand)" }}
      />

      {/* Shared header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-secondary">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30"
            style={{ background: "var(--gradient-brand)" }}
          >
            <span className="text-white font-black text-sm leading-none">N</span>
          </div>
          <span className="font-black text-lg text-foreground tracking-tight">nublue</span>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1.5">
            <Flame size={14} className="fill-orange-400 text-orange-400" />
            <span className="text-sm font-black text-foreground">{streak}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1.5">
            <Zap size={14} className="fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-black text-foreground">{xp} XP</span>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SkillPathTab
                levels={levels}
                completedLevels={completedLevels}
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
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ChallengesTab bestRound={bestRound} onStartChallenge={onStartChallenge} />
            </motion.div>
          )}
          {activeTab === "ranking" && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <RankingTab userXp={xp} userStreak={streak} />
            </motion.div>
          )}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ProfileTab
                xp={xp}
                streak={streak}
                completedLevels={completedLevels}
                bestRound={bestRound}
                totalSolved={totalSolved}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="relative flex border-t border-secondary bg-white">
        {navItems.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
              activeTab === id ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon size={22} />
            <span className="text-xs font-black">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
