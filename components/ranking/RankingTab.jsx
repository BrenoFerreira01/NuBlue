import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Flame, Trophy, Zap } from "lucide-react";
import { clsx } from "clsx";
import { api } from "lib/api";
export function RankingTab() {
  const [tab, setTab] = useState("weekly");
  const [leaderboard, setLeaderboard] = useState([]);
  const [me, setMe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const medals = ["🥇", "🥈", "🥉"];
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadFailed(false);
    api
      .leaderboard(tab)
      .then(({ entries, me: position }) => {
        if (!active) return;
        setLeaderboard(entries);
        setMe(position ?? null);
      })
      .catch(() => {
        if (active) {
          setLeaderboard([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {/* Header */}
      <div className="px-3 pb-2 pt-4 sm:px-4">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={22} className="text-yellow-400" />
          <h2 className="text-xl font-black text-foreground">Ranking</h2>
        </div>
        {/* Toggle */}
        <div className="flex bg-background rounded-xl p-1">
          {["weekly", "all"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex-1 py-2 rounded-lg font-black text-sm transition-all",
                tab === t
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground",
              )}
            >
              {t === "weekly" ? "Esta Semana" : "Geral"}
            </button>
          ))}
        </div>
      </div>

      {/* Sua posição */}
      {me && !isLoading && (
        <div className="px-3 pb-2 sm:px-4">
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[var(--landing-puzzle-border)] bg-card px-4 py-3 dark:border-accent/45 dark:bg-[var(--surface-glass-strong)]"
            aria-label="Sua posição no ranking"
          >
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--landing-puzzle-kicker)] dark:text-muted-foreground">
                Sua posição
              </p>
              <p className="text-sm font-bold text-foreground">
                {me.optedIn
                  ? me.xp > 0
                    ? `${me.rank}º lugar`
                    : "Ganhe XP para entrar na lista"
                  : "Ative “Aparecer no ranking” em Ajustes"}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm font-black text-foreground">
              <Zap size={14} className="fill-yellow-400 text-yellow-400" />
              {me.xp} XP
            </span>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-2 px-3 pb-8 sm:px-4">
        {!isLoading && leaderboard.length === 0 && (
          <p className="rounded-2xl border border-secondary/40 p-5 text-center text-sm font-semibold text-muted-foreground">
            {loadFailed
              ? "Não foi possível carregar o ranking agora."
              : "Ainda não há estudantes que escolheram aparecer no ranking."}
          </p>
        )}
        {isLoading && (
          <p className="py-5 text-center text-sm font-semibold text-muted-foreground">
            Carregando ranking...
          </p>
        )}
        {leaderboard.map((player, idx) => {
          const rank = idx + 1;
          return (
            <motion.div
              key={player.nickname}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={clsx(
                "flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-3 transition-all sm:gap-3 sm:px-4",
                "border-secondary/40",
              )}
              style={{
                background: "var(--surface-glass)",
              }}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {rank <= 3 ? (
                  <span className="text-xl">{medals[rank - 1]}</span>
                ) : (
                  <span className="text-sm font-black text-muted-foreground">
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div
                className={clsx(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl text-xl sm:size-10",
                  "bg-card",
                )}
              >
                {Array.from(player.nickname.trim())[0]?.toLocaleUpperCase(
                  "pt-BR",
                ) || "👤"}
              </div>

              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate text-foreground">
                  {player.nickname}
                </p>
                <div className="flex items-center gap-1">
                  <Flame
                    size={11}
                    className="text-orange-400 fill-orange-400"
                  />
                  <span className="text-xs text-muted-foreground font-bold">
                    {player.streak} dias
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Zap size={13} className="fill-yellow-400 text-yellow-400" />
                  <span className="font-black text-sm text-foreground">
                    {player.xp.toLocaleString("pt-BR")}
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
