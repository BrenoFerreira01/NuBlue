import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Flame, Trophy, Zap } from "lucide-react";
import { clsx } from "clsx";
import { MOCK_PLAYERS } from "../../data/mockPlayers";

export function RankingTab({ userXp, userStreak }: { userXp: number; userStreak: number }) {
  const [tab, setTab] = useState<"weekly" | "all">("weekly");

  const leaderboard = useMemo(() => {
    const userXpVal = userXp;
    const all = [
      ...MOCK_PLAYERS.map((p) => ({
        ...p,
        score: tab === "weekly" ? p.weeklyXp : p.xp,
        isUser: false,
      })),
      { id: 0, name: "Você", score: userXpVal, streak: userStreak, emoji: "🧑‍💻", isUser: true, xp: userXp, weeklyXp: userXp },
    ];
    return all.sort((a, b) => b.score - a.score);
  }, [tab, userXp, userStreak]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={22} className="text-yellow-400" />
          <h2 className="text-xl font-black text-foreground">Ranking</h2>
        </div>
        {/* Toggle */}
        <div className="flex bg-background rounded-xl p-1">
          {(["weekly", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex-1 py-2 rounded-lg font-black text-sm transition-all",
                tab === t ? "bg-primary text-white shadow-lg" : "text-muted-foreground",
              )}
            >
              {t === "weekly" ? "Esta Semana" : "Geral"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 pb-8 space-y-2">
        {leaderboard.map((player, idx) => {
          const isUser = player.isUser;
          const rank = idx + 1;
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={clsx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all",
                isUser
                  ? "border-primary/50 shadow-lg shadow-primary/15"
                  : "border-secondary/40",
              )}
              style={{
                background: isUser
                  ? "var(--surface-cyan-overlay)"
                  : "var(--surface-glass)",
              }}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {rank <= 3 ? (
                  <span className="text-xl">{medals[rank - 1]}</span>
                ) : (
                  <span className="text-sm font-black text-muted-foreground">{rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl",
                isUser ? "bg-primary/30" : "bg-white",
              )}>
                {player.emoji}
              </div>

              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate text-foreground">
                  {player.name}
                  {isUser && <span className="text-muted-foreground ml-1">· Você</span>}
                </p>
                <div className="flex items-center gap-1">
                  <Flame size={11} className="text-orange-400 fill-orange-400" />
                  <span className="text-xs text-muted-foreground font-bold">{player.streak} dias</span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Zap size={13} className="fill-yellow-400 text-yellow-400" />
                  <span className="font-black text-sm text-foreground">
                    {player.score.toLocaleString("pt-BR")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
