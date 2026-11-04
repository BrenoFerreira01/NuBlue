import { motion } from "motion/react";
import { Star, Trophy, Zap } from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "../../../components/ThemeToggle";

export function ResultScreen({
  isCorrect,
  xpEarned,
  isChallenge,
  dark,
  onThemeChange,
  onContinue,
  onRetry,
  onEndChallenge,
  successDescription,
  failureDescription,
  rewardLabel = "XP ganho",
  endChallengeLabel = "Voltar para desafios",
}: {
  isCorrect: boolean;
  xpEarned: number;
  isChallenge: boolean;
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  onContinue: () => void;
  onRetry: () => void;
  onEndChallenge: () => void;
  successDescription?: string;
  failureDescription?: string;
  rewardLabel?: string;
  endChallengeLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20 text-center"
    >
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle dark={dark} onToggle={() => onThemeChange(!dark)} />
      </div>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: isCorrect ? "var(--glow-success)" : "var(--glow-error)" }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
        className={clsx(
          "mb-5 flex size-32 items-center justify-center rounded-3xl",
          !isCorrect && "border-2 border-destructive/30 bg-destructive/10",
        )}
        style={isCorrect ? { background: "var(--gradient-success)", boxShadow: "var(--shadow-success)" } : undefined}
      >
        {isCorrect ? <Trophy size={58} className="text-white" /> : <span className="text-6xl">😔</span>}
      </motion.div>

      {isCorrect && (
        <div className="mb-5 flex gap-3">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 + index * 0.09, type: "spring", stiffness: 260 }}
            >
              <Star size={36} className="fill-yellow-400 text-yellow-400" />
            </motion.div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mb-5"
      >
        {isChallenge ? (
          isCorrect ? (
            <>
              <h1 className="mb-1 text-3xl font-black text-foreground">Desafio de hoje concluído!</h1>
              <p className="text-muted-foreground">{successDescription ?? "Você resolveu a cruzadinha diária. Amanhã tem outra."}</p>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-3xl font-black text-foreground">Tentativas encerradas</h1>
              <p className="text-muted-foreground">{failureDescription ?? "O desafio de hoje terminou. Volte amanhã para uma nova cruzadinha."}</p>
            </>
          )
        ) : isCorrect ? (
          <>
            <h1 className="mb-1 text-3xl font-black text-foreground">Incrível! 🎉</h1>
            <p className="text-muted-foreground">Você resolveu todas as equações!</p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-3xl font-black text-foreground">Quase lá...</h1>
            <p className="text-muted-foreground">Não desista! Você consegue.</p>
          </>
        )}
      </motion.div>

      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.32 }}
          className="mb-6 flex w-full max-w-xs items-center gap-3 rounded-2xl border border-accent/45 px-6 py-4"
          style={{ background: "var(--surface-glass-strong)" }}
        >
          <Zap size={28} className="shrink-0 fill-yellow-400 text-yellow-400" />
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              {rewardLabel}
            </p>
            <p className="text-2xl font-black text-foreground">+{xpEarned} XP</p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="w-full max-w-xs space-y-3"
      >
        {isChallenge ? (
          <button
            onClick={onEndChallenge}
            className="w-full rounded-2xl py-4 text-lg font-black text-foreground transition-colors dark:text-[#8070bb] dark:hover:text-white"
            style={{ background: dark ? "rgba(26, 16, 80, 0.6)" : "var(--surface-cyan-strong)" }}
          >
            {endChallengeLabel}
          </button>
        ) : isCorrect ? (
          <button
            onClick={onContinue}
            className="w-full rounded-2xl border-b-4 border-foreground py-4 text-lg font-black text-white transition-all hover:brightness-110 active:translate-y-1 active:border-b-0 dark:border-[#3020cc]"
            style={{ background: "var(--primary)" }}
          >
            Continuar
          </button>
        ) : (
          <>
            <button
              onClick={onRetry}
              className="w-full rounded-2xl border-b-4 border-foreground py-4 text-lg font-black text-white transition-all hover:brightness-110 dark:border-[#3020cc]"
              style={{ background: "var(--primary)" }}
            >
              Tentar novamente
            </button>
            <button
              onClick={onContinue}
              className="w-full rounded-2xl py-4 text-lg font-black text-foreground transition-colors dark:text-[#8070bb] dark:hover:text-white"
              style={{ background: dark ? "rgba(26, 16, 80, 0.6)" : "var(--surface-cyan-strong)" }}
            >
              Voltar ao início
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
