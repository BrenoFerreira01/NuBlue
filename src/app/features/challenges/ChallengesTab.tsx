import { motion } from "motion/react";
import { CalendarDays, CheckCircle2, CircleAlert, Flame, Swords, Trophy } from "lucide-react";
import { formatDateKey, type DailyChallengeStatus } from "./dailyChallenge";

export function ChallengesTab({
  challengeDate,
  dark,
  status,
  completedCount,
  currentStreak,
  bestStreak,
  onStartChallenge,
}: {
  challengeDate: string;
  dark: boolean;
  status: DailyChallengeStatus | null;
  completedCount: number;
  currentStreak: number;
  bestStreak: number;
  onStartChallenge: () => void;
}) {
  const isLocked = status === "completed" || status === "failed";

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
            <h2 className="text-lg font-black text-foreground">Desafio diário</h2>
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <CalendarDays size={13} /> {formatDateKey(challengeDate)}
            </p>
          </div>
        </div>
        <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
          Uma cruzadinha nova a cada dia local, igual durante todo o dia. Você tem três vidas; o desafio seguinte chega à meia-noite.
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
            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Resolvidos</p>
            <p className="text-xl font-black text-foreground">{completedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Flame size={20} className="fill-orange-400 text-orange-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Maior sequência</p>
            <p className="text-xl font-black text-foreground">{bestStreak} dias</p>
          </div>
        </div>
        <p className="col-span-2 text-xs font-bold text-muted-foreground">
          Sequência atual: {currentStreak} {currentStreak === 1 ? "dia" : "dias"}
        </p>
      </section>

      <section
        className="rounded-2xl border border-accent/35 p-4"
        style={{ background: "var(--surface-cyan)" }}
        aria-live="polite"
      >
        {status === "completed" ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="font-black text-foreground">Desafio concluído</p>
              <p className="mt-1 text-sm text-muted-foreground">Sua resposta e seu XP já foram salvos. Volte amanhã para outra cruzadinha.</p>
            </div>
          </div>
        ) : status === "failed" ? (
          <div className="flex items-start gap-3">
            <CircleAlert size={21} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-black text-foreground">Tentativas encerradas</p>
              <p className="mt-1 text-sm text-muted-foreground">O desafio de hoje terminou. Uma nova cruzadinha fica disponível amanhã.</p>
            </div>
          </div>
        ) : status === "in_progress" ? (
          <div className="flex items-start gap-3">
            <Swords size={21} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-black text-foreground">Desafio em andamento</p>
              <p className="mt-1 text-sm text-muted-foreground">Suas respostas e vidas ficaram salvas. Continue de onde parou.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Swords size={21} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-black text-foreground">Pronto para jogar?</p>
              <p className="mt-1 text-sm text-muted-foreground">Resolva a cruzadinha de hoje para ganhar XP e manter sua sequência diária.</p>
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
        {status === "completed" ? "Concluído por hoje" : status === "failed" ? "Volte amanhã" : status === "in_progress" ? "Retomar desafio" : "Iniciar desafio"}
      </motion.button>
    </div>
  );
}
