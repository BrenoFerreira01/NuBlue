import { motion } from "motion/react";
import { Check, Flame, Star, Zap } from "lucide-react";
import { clsx } from "clsx";
import { LEVELS } from "../../data/levels";

export function ProfileTab({
  userName, xp, streak, completedLevels, dailyChallengesCompleted, bestDailyStreak, totalSolved,
}: {
  userName: string;
  xp: number;
  streak: number;
  completedLevels: number[];
  dailyChallengesCompleted: number;
  bestDailyStreak: number;
  totalSolved: number;
}) {
  const userLevel = Math.floor(xp / 50) + 1;
  const xpInLevel = xp % 50;
  const progressPct = (xpInLevel / 50) * 100;
  const avatarInitial = Array.from(userName.trim())[0]?.toLocaleUpperCase("pt-BR") || "N";
  const allLevelsCompleted = LEVELS.every((level) => completedLevels.includes(level.id));

  const achievements = [
    {
      emoji: "🏁",
      name: "Primeiro Passo",
      desc: "Complete qualquer nível",
      unlocked: completedLevels.length >= 1,
    },
    {
      emoji: "🎓",
      name: "Mestre da trilha",
      desc: "Complete as 15 sessões dos cinco capítulos",
      unlocked: allLevelsCompleted,
    },
    {
      emoji: "⚔️",
      name: "Desafiador",
      desc: "Conclua seu primeiro desafio diário",
      unlocked: dailyChallengesCompleted >= 1,
    },
    {
      emoji: "🔥",
      name: "Em Chamas",
      desc: "Mantenha 7 dias de sequência",
      unlocked: streak >= 7,
    },
    {
      emoji: "💎",
      name: "Colecionador de XP",
      desc: "Acumule 100 XP no total",
      unlocked: xp >= 100,
    },
    {
      emoji: "🌪️",
      name: "Imparável",
      desc: "Conclua desafios diários por 7 dias seguidos",
      unlocked: bestDailyStreak >= 7,
    },
  ];

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
      {/* Profile card */}
      <div
        className="rounded-2xl p-5 border border-accent/45 relative overflow-hidden"
        style={{ background: "var(--gradient-profile)" }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: "var(--glow-accent)" }} />
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black sm:size-16 sm:text-3xl"
            style={{ background: "var(--gradient-profile-avatar)" }}
          >
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-foreground sm:text-2xl" title={userName}>{userName}</h2>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <Flame size={13} className="fill-orange-400 text-orange-400" />
                <span className="text-xs font-black text-foreground">{streak} dias</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={13} className="fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-black text-foreground">{xp} XP</span>
              </div>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 bg-primary/30 rounded-full px-2 py-0.5">
              <Star size={11} className="fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-black text-foreground">Nível {userLevel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Níveis", value: `${completedLevels.length}/${LEVELS.length}`, icon: "📚" },
          { label: "Desafios diários", value: String(dailyChallengesCompleted), icon: "⚔️" },
          { label: "Maior sequência", value: bestDailyStreak > 0 ? `${bestDailyStreak} dias` : "—", icon: "🔥" },
          { label: "Resolvidas", value: String(totalSolved), icon: "✅" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="rounded-2xl p-3 border border-secondary/40 text-center"
            style={{ background: "var(--surface-glass)" }}
          >
            <span className="text-2xl block mb-1">{icon}</span>
            <p className="text-lg font-black text-foreground leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-bold">{label}</p>
          </div>
        ))}
      </div>

      {/* XP Progress */}
      <div
        className="rounded-2xl p-4 border border-secondary/40"
        style={{ background: "var(--surface-glass)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Progresso XP</p>
          <p className="text-xs text-muted-foreground font-bold">Nível {userLevel} → {userLevel + 1}</p>
        </div>
        <div className="h-3 bg-background rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gradient-progress)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, type: "spring" }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground">{xpInLevel} XP</span>
          <span className="text-xs text-muted-foreground">50 XP</span>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">
          Conquistas
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {achievements.map((a) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                "rounded-2xl p-3 border transition-all",
                  a.unlocked
                  ? "border-accent/35 shadow-sm shadow-accent/10"
                  : "border-secondary/60",
              )}
              style={{
                background: a.unlocked
                  ? "var(--surface-cyan-overlay)"
                  : "var(--surface-glass-soft)",
              }}
            >
              <span className={clsx("text-2xl block mb-1.5", !a.unlocked && "grayscale opacity-30")}>
                {a.emoji}
              </span>
              <p className={clsx("font-black text-xs", a.unlocked ? "text-foreground" : "text-muted-foreground")}>
                {a.name}
              </p>
              <p className={clsx("text-xs mt-0.5", a.unlocked ? "text-muted-foreground" : "text-muted-foreground")}>
                {a.desc}
              </p>
              {a.unlocked && (
                <div className="mt-1.5 flex items-center gap-1">
                  <Check size={11} className="text-success" strokeWidth={3} />
                  <span className="text-xs font-bold text-success">Conquistada</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
