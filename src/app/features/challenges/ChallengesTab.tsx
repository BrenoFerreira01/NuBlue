import { motion } from "motion/react";
import { Swords, Trophy } from "lucide-react";
import { clsx } from "clsx";

export function ChallengesTab({
  bestRound, onStartChallenge,
}: {
  bestRound: number;
  onStartChallenge: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Hero card */}
      <div
        className="rounded-2xl p-5 border border-accent/35 relative overflow-hidden"
        style={{ background: "var(--gradient-brand-soft)" }}
      >
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10"
          style={{ background: "var(--glow-accent)" }} />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Swords size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-black text-foreground text-lg">Desafio Diário</h2>
            <p className="text-xs text-muted-foreground">Cruzadinhas progressivas</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Resolva cruzadinhas matemáticas cada vez mais difíceis. A dificuldade aumenta suavemente a cada rodada — até você perder!
        </p>
      </div>

      {/* Best score */}
      <div
        className="rounded-2xl p-4 border border-accent/45 flex items-center gap-4"
        style={{ background: "var(--surface-glass-strong)" }}
      >
        <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
          <Trophy size={22} className="text-yellow-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-black uppercase tracking-wide">Melhor Sequência</p>
          {bestRound > 0 ? (
            <p className="text-2xl font-black text-foreground">
              Rodada {bestRound}
              <span className="text-sm text-muted-foreground font-bold ml-2">🏆 Recorde</span>
            </p>
          ) : (
            <p className="text-lg font-bold text-muted-foreground">Ainda sem recorde</p>
          )}
        </div>
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl p-4 border border-accent/35"
        style={{ background: "var(--surface-cyan)" }}
      >
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Como funciona</p>
        {[
          { emoji: "🧩", text: "Cada rodada gera uma cruzadinha matemática única" },
          { emoji: "📈", text: "A dificuldade aumenta sutilmente a cada rodada" },
          { emoji: "❤️", text: "Você tem 3 tentativas por rodada" },
          { emoji: "💀", text: "3 erros e o desafio termina" },
          { emoji: "🏆", text: "Tente superar seu próprio recorde!" },
        ].map(({ emoji, text }) => (
          <div key={text} className="flex items-start gap-3 mb-2.5 last:mb-0">
            <span className="text-base flex-shrink-0">{emoji}</span>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      {/* Difficulty progression */}
      <div
        className="rounded-2xl p-4 border border-accent/35"
        style={{ background: "var(--surface-cyan)" }}
      >
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Progressão de Dificuldade</p>
        <div className="space-y-2">
          {[
            { range: "Rodadas 1–2", label: "Adição", color: "bg-emerald-500" },
            { range: "Rodadas 3–5", label: "+ Subtração", color: "bg-yellow-500" },
            { range: "Rodadas 6–9", label: "+ Multiplicação", color: "bg-orange-500" },
            { range: "Rodadas 10+", label: "+ Divisão", color: "bg-red-500" },
          ].map(({ range, label, color }) => (
            <div key={range} className="flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full flex-shrink-0", color)} />
              <span className="text-xs text-muted-foreground w-28 font-bold">{range}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Start button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onStartChallenge}
        className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-foreground transition-all hover:brightness-110 flex items-center justify-center gap-2"
        style={{ background: "var(--gradient-brand)" }}
      >
        <Swords size={20} />
        Iniciar Desafio
      </motion.button>
    </div>
  );
}
