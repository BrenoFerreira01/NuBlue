import { motion } from "motion/react";
import { Check, Flame, Star, Zap } from "lucide-react";
import { clsx } from "clsx";
import { LEVELS } from "../../data/levels";

export function ProfileTab({
  xp, streak, completedLevels, bestRound, totalSolved,
}: {
  xp: number;
  streak: number;
  completedLevels: number[];
  bestRound: number;
  totalSolved: number;
}) {
  const userLevel = Math.floor(xp / 50) + 1;
  const xpInLevel = xp % 50;
  const progressPct = (xpInLevel / 50) * 100;

  const achievements = [
    {
      emoji: "🏁",
      name: "Primeiro Passo",
      desc: "Complete qualquer nível",
      unlocked: completedLevels.length >= 1,
    },
    {
      emoji: "🎓",
      name: "Cruzadinha Mestre",
      desc: "Complete todos os níveis base",
      unlocked: completedLevels.length >= 3,
    },
    {
      emoji: "⚔️",
      name: "Desafiador",
      desc: "Alcance a Rodada 5 no Desafio",
      unlocked: bestRound >= 5,
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
      desc: "Alcance a Rodada 10 no Desafio",
      unlocked: bestRound >= 10,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Profile card */}
      <div
        className="rounded-2xl p-5 border border-accent/45 relative overflow-hidden"
        style={{ background: "var(--gradient-profile)" }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: "var(--glow-accent)" }} />
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: "var(--gradient-profile-avatar)" }}
          >
            🧑‍💻
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground">Jogador</h2>
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Níveis", value: `${completedLevels.length}/${LEVELS.length}`, icon: "📚" },
          { label: "Melhor Desafio", value: bestRound > 0 ? `Rd. ${bestRound}` : "—", icon: "⚔️" },
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
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                "rounded-2xl p-3 border transition-all",
                a.unlocked
                  ? "border-secondary/30 shadow-sm shadow-accent/10"
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
                  <Check size={11} className="text-emerald-400" strokeWidth={3} />
                  <span className="text-xs text-emerald-400 font-bold">Conquistada</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
