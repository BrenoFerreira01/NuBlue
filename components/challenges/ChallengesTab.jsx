import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Flame,
  Swords,
  Trophy,
} from "lucide-react";
import { formatDateKey } from "lib/game/dailyChallenge";
import { formatCountdown } from "components/game/LivesBadge";

/** Próxima meia-noite local (visitante) em ms. */
function nextLocalMidnight() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}
export function ChallengesTab({
  challengeDate,
  dark,
  status,
  completedCount,
  currentStreak,
  bestStreak,
  onStartChallenge,
  isChallengeMode = false,
  challengeInfo = null,
}) {
  const isLocked = status === "completed" || status === "failed";
  const title = isChallengeMode ? "Modo Desafio" : "Desafio diário";
  const resetsAt = challengeInfo?.resetsAt ?? nextLocalMidnight();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
      <section
        className="relative overflow-hidden rounded-2xl border border-accent/35 p-5"
        style={{ background: "var(--gradient-brand-soft)" }}
      >
        <div
          className="absolute -right-6 -top-6 size-28 rounded-full opacity-10"
          style={{ background: "var(--glow-accent)" }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent/20">
            <Swords size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">{title}</h2>
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <CalendarDays size={13} /> {formatDateKey(challengeDate)}
            </p>
          </div>
        </div>
        <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
          {isChallengeMode
            ? "Cruzadinhas sorteadas sem fim, começando na sua dificuldade geral e ficando mais difíceis a cada 3 acertos. O modo tem 5 vidas próprias, que voltam sozinhas na virada do dia."
            : "Uma sequência sem fim de cruzadinhas, que começa na sua dificuldade geral e fica mais difícil a cada 3 acertos. O modo tem três vidas próprias: no 3º erro, o desafio do dia termina."}
        </p>
      </section>

      <section
        className="grid grid-cols-2 gap-3 rounded-2xl border border-accent/45 p-4"
        style={{ background: "var(--surface-glass-strong)" }}
        aria-label="Seu histórico de desafios diários"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15">
            <Trophy size={20} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Resolvidos
            </p>
            <p className="text-xl font-black text-foreground">
              {completedCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Flame size={20} className="fill-orange-400 text-orange-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Maior sequência
            </p>
            <p className="text-xl font-black text-foreground">
              {bestStreak} dias
            </p>
          </div>
        </div>
        <p className="col-span-2 text-xs font-bold text-muted-foreground">
          Sequência atual: {currentStreak}{" "}
          {currentStreak === 1 ? "dia" : "dias"}
        </p>
      </section>

      {(isLocked || challengeInfo) && (
        <p
          className="rounded-2xl bg-[var(--landing-hero-badge-background)] px-4 py-3 text-sm font-black text-[var(--landing-hero-badge-foreground)] dark:bg-accent/15 dark:text-accent"
          aria-live="polite"
        >
          {isLocked
            ? `Vidas voltam em ${formatCountdown(resetsAt, now)}`
            : `${challengeInfo.hearts} ${challengeInfo.hearts === 1 ? "vida" : "vidas"} hoje · renovam em ${formatCountdown(resetsAt, now)}`}
        </p>
      )}

      <section
        className="rounded-2xl border border-accent/35 p-4"
        style={{ background: "var(--surface-cyan)" }}
        aria-live="polite"
      >
        {status === "completed" ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="font-black text-foreground">Desafio encerrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Suas 3 vidas acabaram e seus acertos e XP foram salvos. Volte
                amanhã para um novo desafio.
              </p>
            </div>
          </div>
        ) : status === "failed" ? (
          <div className="flex items-start gap-3">
            <CircleAlert
              size={21}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div>
              <p className="font-black text-foreground">
                Tentativas encerradas
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Suas 3 vidas acabaram sem acertos hoje. Um novo desafio fica
                disponível amanhã.
              </p>
            </div>
          </div>
        ) : status === "in_progress" ? (
          <div className="flex items-start gap-3">
            <Swords size={21} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-black text-foreground">Desafio em andamento</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seus acertos e vidas ficaram salvos. Continue de onde parou.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Swords size={21} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-black text-foreground">Pronto para jogar?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Acerte quantas cruzadinhas conseguir para ganhar XP e manter sua
                sequência diária.
              </p>
            </div>
          </div>
        )}
      </section>

      <motion.button
        whileTap={isLocked ? undefined : { scale: 0.97 }}
        onClick={onStartChallenge}
        disabled={isLocked}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-b-4 border-foreground py-4 text-lg font-black text-white transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#9050cc]"
        style={{
          background: dark
            ? "linear-gradient(135deg, #6040ff, #c080ff)"
            : "var(--gradient-brand)",
        }}
      >
        <Swords size={20} />
        {status === "completed"
          ? "Concluído por hoje"
          : status === "failed"
            ? "Volte amanhã"
            : status === "in_progress"
              ? "Retomar desafio"
              : "Iniciar desafio"}
      </motion.button>
    </div>
  );
}
