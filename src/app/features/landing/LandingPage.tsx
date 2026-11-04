import { useEffect, useState } from "react";
import { ArrowRight, Check, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "../../components/Brand";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { generateLandingDailyPuzzle } from "../challenges/generatePuzzle";
import { AuthDialog, type AuthMode } from "./components/AuthDialog";
import { LandingDailyChallenge } from "./LandingDailyChallenge";
import { readLandingDailyProgress, saveLandingDailyProgress, type LandingDailyStatus } from "./landingDailyProgress";

interface Props {
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  onLogin: () => void;
  onSignup: (name: string) => void;
  dailyChallengeDate: string;
}

export function LandingPage({
  dark,
  onThemeChange,
  onLogin,
  onSignup,
  dailyChallengeDate,
}: Props) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [dailyChallengeStatus, setDailyChallengeStatus] = useState<LandingDailyStatus | null>(
    () => readLandingDailyProgress(dailyChallengeDate)?.status ?? null,
  );
  const [isDailyChallengeOpen, setIsDailyChallengeOpen] = useState(false);

  useEffect(() => {
    setDailyChallengeStatus(readLandingDailyProgress(dailyChallengeDate)?.status ?? null);
    setIsDailyChallengeOpen(false);
  }, [dailyChallengeDate]);

  const startDailyChallenge = () => {
    const saved = readLandingDailyProgress(dailyChallengeDate);
    if (saved?.status === "completed" || saved?.status === "failed") {
      setDailyChallengeStatus(saved.status);
      return;
    }

    setDailyChallengeStatus("in_progress");
    saveLandingDailyProgress(saved ?? {
      date: dailyChallengeDate,
      status: "in_progress",
      fills: {},
      hearts: 3,
    });
    setIsDailyChallengeOpen(true);
  };

  const closeDailyChallenge = () => {
    setDailyChallengeStatus(readLandingDailyProgress(dailyChallengeDate)?.status ?? null);
    setIsDailyChallengeOpen(false);
  };

  const finishDailyChallenge = (isCorrect: boolean) => {
    const status = isCorrect ? "completed" : "failed";
    const saved = readLandingDailyProgress(dailyChallengeDate);
    if (saved) saveLandingDailyProgress({ ...saved, status });
    setDailyChallengeStatus(status);
    setIsDailyChallengeOpen(false);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background transition-colors">
      <header className="relative z-30 mx-auto flex max-w-[1240px] items-center justify-between gap-2 px-3 py-4 sm:px-5 sm:py-5 lg:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle dark={dark} onToggle={() => onThemeChange(!dark)} />
          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className="hidden rounded-2xl px-5 py-3 text-sm font-extrabold text-foreground transition hover:bg-secondary sm:block"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("signup")}
            className="rounded-2xl bg-primary px-3 py-2.5 text-xs font-black text-primary-foreground shadow-[0_8px_0_var(--button-shadow)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-5 sm:py-3 sm:text-sm"
          >
            Criar conta
          </button>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[690px] max-w-[1240px] items-center gap-10 px-4 pb-20 pt-10 sm:px-5 sm:pb-24 sm:pt-12 lg:grid-cols-[1.03fr_.97fr] lg:px-8 lg:pt-16">
        <div className="relative z-10">
          <div className="mb-7 inline-flex rotate-[-2deg] items-center gap-2 rounded-full bg-[var(--landing-hero-badge-background)] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--landing-hero-badge-foreground)]">
            <Sparkles size={14} /> Matemática que encaixa
          </div>
          <h1 className="max-w-[720px] text-[clamp(3.25rem,7.4vw,7.2rem)] font-black leading-[0.87] tracking-[-0.075em]">
            Sua mente
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-progress)" }}
            >
              vai longe.
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-lg font-semibold leading-relaxed text-muted-foreground sm:text-xl">
            Aprenda matemática resolvendo cruzadinhas inteligentes. Cinco minutos por dia, desafios no seu ritmo e progresso que dá vontade de continuar.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className="group flex items-center justify-center gap-3 rounded-[20px] bg-primary px-7 py-4 font-black text-primary-foreground shadow-[0_9px_0_var(--button-shadow)] transition hover:-translate-y-1 active:translate-y-1 active:shadow-none"
            >
              Começar grátis
              <ArrowRight className="transition group-hover:translate-x-1" size={20} />
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center justify-center gap-3 rounded-[20px] border border-border bg-card px-7 py-4 font-black transition hover:border-primary"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--landing-play-background)] text-[var(--landing-play-foreground)]">
                <Play size={14} fill="currentColor" />
              </span>
              Ver como funciona
            </button>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm font-bold text-muted-foreground">
            {["Sem cartão", "Teste de nível", "No seu ritmo"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check size={16} className="text-[var(--landing-check)]" strokeWidth={3} />
                {item}
              </span>
            ))}
          </div>
        </div>

        <HeroPuzzle
          challengeDate={dailyChallengeDate}
          status={dailyChallengeStatus}
          onStart={startDailyChallenge}
        />
      </section>

      <section id="como-funciona" className="relative bg-primary px-5 py-24 text-primary-foreground">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[.75fr_1.25fr] lg:px-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--landing-section-kicker)]">Como funciona</p>
            <h2 className="mt-4 text-4xl font-black leading-[.98] tracking-[-0.05em] sm:text-6xl">
              Um caminho feito para o seu jeito de pensar.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[30px] bg-primary-foreground/20 sm:grid-cols-3">
            {[
              ["01", "Descubra seu nível", "Um teste curto mede adição, subtração, multiplicação e divisão."],
              ["02", "Complete a cruzadinha", "Preencha os números e veja as equações se conectarem."],
              ["03", "Evolua todo dia", "Ganhe XP, mantenha sua sequência e desbloqueie capítulos."],
            ].map(([number, title, copy]) => (
              <article key={number} className="bg-primary p-7 sm:min-h-64">
                <span className="font-black text-[var(--landing-section-index)]">{number}</span>
                <h3 className="mt-16 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-primary-foreground/70">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-4 px-5 py-8 text-sm font-bold text-muted-foreground sm:flex-row lg:px-12">
        <Brand />
        <p>Aprender matemática pode ser o melhor momento do seu dia.</p>
        <p>© {new Date().getFullYear()} Nublue</p>
      </footer>

      <Dialog
        open={authMode !== null}
        onOpenChange={(open) => {
          if (!open) setAuthMode(null);
        }}
      >
        {authMode && (
          <DialogContent
            overlayClassName="bg-[#09031f]/80 backdrop-blur-md"
            className="auth-dialog-content min-h-0 max-h-[calc(100vh_-_2rem)] overflow-y-auto overscroll-contain rounded-[30px] border border-border bg-card p-5 text-foreground shadow-2xl sm:max-w-md sm:p-7 [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:size-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-secondary [&>button]:text-muted-foreground [&>button]:opacity-100"
          >
            <AuthDialog
              mode={authMode}
              onSubmit={(name) => {
                if (authMode === "signup") onSignup(name?.trim() ?? "");
                else onLogin();
              }}
              onSwitchMode={() => setAuthMode(authMode === "login" ? "signup" : "login")}
            />
          </DialogContent>
        )}
      </Dialog>

      {isDailyChallengeOpen && (
        <LandingDailyChallenge
          key={dailyChallengeDate}
          challengeDate={dailyChallengeDate}
          dark={dark}
          onThemeChange={onThemeChange}
          onClose={closeDailyChallenge}
          onComplete={finishDailyChallenge}
        />
      )}
    </div>
  );
}

function HeroPuzzle({
  challengeDate,
  status,
  onStart,
}: {
  challengeDate: string;
  status: LandingDailyStatus | null;
  onStart: () => void;
}) {
  const puzzle = generateLandingDailyPuzzle(challengeDate);
  const isLocked = status === "completed" || status === "failed";
  const actionLabel = status === "in_progress"
    ? "Continuar desafio"
    : status === "completed"
      ? "Concluído por hoje"
      : status === "failed"
        ? "Volte amanhã para jogar"
        : "Jogar desafio de hoje";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 18 }}
      className="relative mx-auto w-full max-w-[490px]"
    >
      <div className="absolute -left-9 -top-8 size-28 rounded-full bg-[var(--landing-puzzle-glow-start)] opacity-50 blur-2xl" />
      <div className="absolute -bottom-12 -right-8 size-40 rounded-full bg-[var(--landing-puzzle-glow-end)] opacity-40 blur-3xl" />
      <div
        className="relative rounded-[38px] border bg-card p-6 sm:p-9"
        style={{ borderColor: "var(--landing-puzzle-border)", boxShadow: "0 35px 90px var(--landing-puzzle-shadow)" }}
      >
        <div className="mb-7 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[var(--landing-puzzle-kicker)]">Desafio diário</p>
            <h3 className="mt-1 text-xl font-black text-[var(--landing-puzzle-heading)]">Complete a equação</h3>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--landing-xp-background)] px-3 py-1.5 text-xs font-black text-[var(--landing-xp-foreground)]">Recompensa +{puzzle.xpReward} XP</span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Prévia do desafio diário">
          {puzzle.grid.map((row, rowIndex) => row.map((cell, columnIndex) => {
            const key = `${rowIndex}-${columnIndex}`;
            if (!cell) return <div key={key} className="aspect-square" aria-hidden="true" />;

            const isInput = Boolean(cell.inputId);
            const isOperator = cell.type === "operator" || cell.type === "equals";
            const value = isInput ? "?" : cell.type === "equals" ? "=" : cell.value;
            const cellClass = isInput
              ? "animate-pulse border-2 border-[var(--landing-cell-question-border)] bg-[var(--landing-cell-question-background)] text-[var(--landing-cell-question-foreground)]"
              : isOperator
                ? "text-accent"
                : "bg-[var(--landing-cell-background)] text-[var(--landing-cell-foreground)]";

            return (
              <div
                key={key}
                className={`flex aspect-square items-center justify-center rounded-xl text-base font-black sm:rounded-2xl sm:text-xl ${cellClass}`}
                style={!isOperator && !isInput ? { boxShadow: "0 5px 0 var(--landing-cell-shadow)" } : undefined}
              >
                {value}
              </div>
            );
          }))}
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2 sm:mt-8 sm:gap-3" aria-label="Banco de números">
          {puzzle.bank.map((number, index) => (
            <div key={`${number}-${index}`} className="rounded-xl bg-[var(--landing-answer-background)] py-2 text-center text-sm font-black text-[var(--landing-answer-foreground)] sm:rounded-2xl sm:py-3 sm:text-lg">
              {number}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={isLocked}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-primary-foreground shadow-[0_6px_0_var(--button-shadow)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles size={17} aria-hidden="true" />
          {actionLabel}
        </button>
      </div>
    </motion.div>
  );
}
