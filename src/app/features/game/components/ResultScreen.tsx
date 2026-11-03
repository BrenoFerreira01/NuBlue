import { motion } from "motion/react";
import { ChevronRight, Star, Swords, Trophy, Zap } from "lucide-react";
import { clsx } from "clsx";
import type { Level } from "../../../types/game";

export function ResultScreen({
  level, isCorrect, xpEarned,
  isChallenge, challengeRound,
  onContinue, onRetry, onNextRound, onEndChallenge,
}: {
  level: Level;
  isCorrect: boolean;
  xpEarned: number;
  isChallenge: boolean;
  challengeRound: number;
  onContinue: () => void;
  onRetry: () => void;
  onNextRound: () => void;
  onEndChallenge: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: isCorrect
            ? "var(--glow-success)"
            : "var(--glow-error)",
        }}
      />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
        className={clsx(
          "w-32 h-32 rounded-3xl flex items-center justify-center mb-5",
          !isCorrect && "bg-destructive/10 border-2 border-destructive/30",
        )}
        style={
          isCorrect
            ? { background: "var(--gradient-success)", boxShadow: "var(--shadow-success)" }
            : {}
        }
      >
        {isCorrect ? <Trophy size={58} className="text-white" /> : <span className="text-6xl">😔</span>}
      </motion.div>

      {/* Stars on success */}
      {isCorrect && (
        <div className="flex gap-3 mb-5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.09, type: "spring", stiffness: 260 }}
            >
              <Star size={36} className="fill-yellow-400 text-yellow-400" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mb-5"
      >
        {isChallenge ? (
          isCorrect ? (
            <>
              <h1 className="text-3xl font-black text-foreground mb-1">Rodada {challengeRound} concluída!</h1>
              <p className="text-muted-foreground">Pronto para o próximo desafio?</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-foreground mb-1">Sequência encerrada!</h1>
              <p className="text-muted-foreground">
                Você chegou até a <span className="text-foreground font-black">Rodada {challengeRound}</span>
              </p>
            </>
          )
        ) : (
          isCorrect ? (
            <>
              <h1 className="text-3xl font-black text-foreground mb-1">Incrível! 🎉</h1>
              <p className="text-muted-foreground">Você resolveu todas as equações!</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-foreground mb-1">Quase lá...</h1>
              <p className="text-muted-foreground">Não desista! Você consegue.</p>
            </>
          )
        )}
      </motion.div>

      {/* XP card */}
      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.32 }}
          className="flex items-center gap-3 rounded-2xl px-6 py-4 mb-6 border border-accent/45 w-full max-w-xs"
          style={{ background: "var(--surface-glass-strong)" }}
        >
          <Zap size={28} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-xs text-muted-foreground font-black uppercase tracking-wide">XP Ganho</p>
            <p className="text-2xl font-black text-foreground">+{xpEarned} XP</p>
          </div>
        </motion.div>
      )}

      {/* Challenge round badge */}
      {isChallenge && !isCorrect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38 }}
          className="flex items-center gap-2 mb-6"
        >
          <Swords size={18} className="text-muted-foreground" />
          <span className="text-muted-foreground font-bold">Melhor resultado: Rodada {challengeRound}</span>
        </motion.div>
      )}

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="w-full max-w-xs space-y-3"
      >
        {isChallenge ? (
          isCorrect ? (
            <>
              <button
                onClick={onNextRound}
                className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-foreground transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                style={{ background: "var(--primary)" }}
              >
                Próxima Rodada <ChevronRight size={20} />
              </button>
              <button
                onClick={onEndChallenge}
                className="w-full py-4 rounded-2xl font-black text-lg text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: "var(--surface-cyan-strong)" }}
              >
                Encerrar Desafio
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-foreground transition-all hover:brightness-110"
                style={{ background: "var(--primary)" }}
              >
                Tentar Novamente
              </button>
              <button
                onClick={onEndChallenge}
                className="w-full py-4 rounded-2xl font-black text-lg text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: "var(--surface-cyan-strong)" }}
              >
                Voltar
              </button>
            </>
          )
        ) : (
          isCorrect ? (
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-foreground transition-all hover:brightness-110 active:border-b-0 active:translate-y-1"
              style={{ background: "var(--primary)" }}
            >
              Continuar
            </button>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-foreground transition-all hover:brightness-110"
                style={{ background: "var(--primary)" }}
              >
                Tentar Novamente
              </button>
              <button
                onClick={onContinue}
                className="w-full py-4 rounded-2xl font-black text-lg text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: "var(--surface-cyan-strong)" }}
              >
                Voltar ao Início
              </button>
            </>
          )
        )}
      </motion.div>
    </motion.div>
  );
}
