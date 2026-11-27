import { motion } from "motion/react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Divide,
  Lock,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { CHAPTERS, DIFF_CHIP, DIFF_LABEL } from "lib/game/levels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "components/ui/dropdown-menu";

// Emojis de sinais têm cor própria; os sinais de operação viram ícones brancos.
const OPERATION_ICONS = {
  "➕": Plus,
  "➖": Minus,
  "✖️": X,
  "➗": Divide,
};

function LevelSymbol({ emoji }) {
  const Icon = OPERATION_ICONS[emoji];
  if (Icon) {
    return (
      <Icon
        className="size-9 text-white sm:size-10"
        strokeWidth={3.5}
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="text-3xl sm:text-4xl" aria-hidden="true">
      {emoji}
    </span>
  );
}

export function SkillPathTab({
  levels,
  bonusLevel,
  completedLevels,
  levelAvailability,
  chapterId,
  onChapterChange,
  onStartLevel,
}) {
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0];
  const chapterLevels = levels.filter((level) => level.chapter === chapter.id);
  const availabilityByLevel = levelAvailability
    ? new Map(levelAvailability.levels.map((level) => [level.id, level.status]))
    : null;
  const completedInChapter = availabilityByLevel
    ? chapterLevels.filter(
        (level) => availabilityByLevel.get(level.id) === "completed",
      ).length
    : chapterLevels.filter((level) => completedLevels.includes(level.id))
        .length;
  const progress = chapterLevels.length
    ? (completedInChapter / chapterLevels.length) * 100
    : 0;
  const showBonus =
    chapter.id === 5 &&
    Boolean(bonusLevel) &&
    (levelAvailability
      ? levelAvailability.bonusAvailable
      : levels
          .filter((level) => !level.isBonus)
          .every((level) => completedLevels.includes(level.id)));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Selecionar capítulo. Atual: ${chapter.title}`}
              className="w-full rounded-2xl border-2 border-[var(--landing-puzzle-border)] bg-card p-4 text-left shadow-[0_18px_40px_var(--landing-puzzle-shadow)] transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 dark:border dark:border-accent/45 dark:bg-[var(--surface-glass-strong)] dark:shadow-none dark:hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--landing-puzzle-kicker)] dark:text-muted-foreground">
                    <BookOpen size={14} aria-hidden="true" />
                    <span className="text-xs font-black uppercase tracking-widest">
                      Capítulo {chapter.id} — {chapter.title}
                    </span>
                  </div>
                  <h1 className="break-words text-lg font-black leading-tight text-foreground sm:text-xl">
                    Cruzadinhas de Matemática
                  </h1>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {chapter.description}
                  </p>
                </div>
                <ChevronDown
                  size={20}
                  className="mt-1 shrink-0 text-primary dark:text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div
                className="mt-3 flex items-center gap-2"
                role="progressbar"
                aria-label={`Progresso do capítulo ${chapter.id}`}
                aria-valuemin={0}
                aria-valuemax={chapterLevels.length}
                aria-valuenow={completedInChapter}
              >
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary dark:bg-background">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${progress}%`,
                      background: "var(--gradient-progress)",
                    }}
                  />
                </div>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  {completedInChapter}/{chapterLevels.length}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(92vw,420px)] rounded-2xl border-border bg-popover p-2"
          >
            <DropdownMenuRadioGroup
              value={String(chapter.id)}
              onValueChange={(value) => onChapterChange(Number(value))}
            >
              {CHAPTERS.map((item) => (
                <DropdownMenuRadioItem
                  key={item.id}
                  value={String(item.id)}
                  className="min-h-11 cursor-pointer rounded-xl py-2.5 text-sm font-bold focus:bg-secondary focus:text-foreground"
                >
                  Capítulo {item.id} — {item.title}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative px-3 pb-8 sm:px-4">
        <div className="relative mx-auto max-w-sm pt-3 sm:pt-4">
          <div className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-px border-l-2 border-dashed border-secondary dark:border-[#2a1a6e]" />
          <div className="flex flex-col gap-6">
            {chapterLevels.map((level, index) => {
              const previousLevel = chapterLevels[index - 1];
              const remoteStatus = availabilityByLevel?.get(level.id);
              const completed = availabilityByLevel
                ? remoteStatus === "completed"
                : completedLevels.includes(level.id);
              const locked = availabilityByLevel
                ? remoteStatus !== "available" && remoteStatus !== "completed"
                : Boolean(
                    previousLevel &&
                    !completedLevels.includes(previousLevel.id),
                  );
              const current = availabilityByLevel
                ? remoteStatus === "available"
                : !completed && !locked;
              const alignRight = index % 2 === 1;
              const startsUnit = level.unit !== previousLevel?.unit;
              return (
                <motion.div
                  key={level.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: index * 0.06,
                    type: "spring",
                    stiffness: 200,
                  }}
                  className="relative z-10"
                >
                  {startsUnit && level.unit && (
                    <p className="mb-3 rounded-xl bg-secondary/60 px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      Unidade {level.unit} — {level.unitTitle}
                    </p>
                  )}
                  <div
                    className={clsx(
                      "flex min-w-0",
                      alignRight ? "justify-end" : "justify-start",
                    )}
                  >
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onStartLevel(level)}
                      aria-label={`Sessão ${level.session}: ${level.title}${locked ? ", bloqueada" : ""}`}
                      className={clsx(
                        "group flex min-w-0 max-w-[calc(50%_-_0.75rem)] flex-col items-center gap-2.5 rounded-2xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        locked && "cursor-not-allowed",
                      )}
                    >
                      <div
                        className={clsx(
                          "relative flex size-[76px] items-center justify-center rounded-[20px] border-b-4 transition-all duration-200 sm:size-[88px] sm:rounded-[22px]",
                          completed &&
                            "border-success/80 bg-success shadow-lg shadow-success/25 dark:border-emerald-700 dark:bg-emerald-500 dark:shadow-emerald-500/30",
                          current &&
                            "border-foreground bg-primary shadow-2xl shadow-primary/50 group-hover:brightness-110 dark:border-[#3020cc] dark:bg-[#5040ff] dark:shadow-[#5040ff]/50",
                          locked &&
                            "border-accent bg-card dark:border-[#221660] dark:bg-[#140a3a]",
                        )}
                      >
                        {completed ? (
                          <Check
                            size={32}
                            strokeWidth={3}
                            className="text-success-foreground dark:text-white"
                          />
                        ) : locked ? (
                          <Lock
                            size={24}
                            className="text-primary/70 dark:text-[#3a2a70]"
                          />
                        ) : (
                          <LevelSymbol emoji={level.emoji} />
                        )}
                        {current && (
                          <motion.div
                            className="absolute inset-0 rounded-[20px] border-2 border-white/25 sm:rounded-[22px]"
                            animate={{ opacity: [0.2, 0.7, 0.2] }}
                            transition={{ repeat: Infinity, duration: 2.5 }}
                          />
                        )}
                      </div>
                      <div className="w-full text-center">
                        <p
                          className={clsx(
                            "break-words text-sm font-black leading-tight",
                            locked
                              ? "text-muted-foreground dark:text-[#3a2a70]"
                              : "text-foreground dark:text-white",
                          )}
                        >
                          {level.title}
                        </p>
                        <span
                          className={clsx(
                            "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold sm:text-xs",
                            locked
                              ? "text-muted-foreground dark:text-[#3a2a70]"
                              : DIFF_CHIP[level.difficulty],
                          )}
                        >
                          {DIFF_LABEL[level.difficulty]}
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              );
            })}
            {showBonus && bonusLevel && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex justify-center"
              >
                <button
                  type="button"
                  onClick={() => onStartLevel(bonusLevel)}
                  className="flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl border border-purple-400/50 bg-purple-500/10 p-4 text-left transition hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {bonusLevel.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-foreground">
                      {bonusLevel.title}
                    </span>
                    <span className="mt-1 inline-block rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-bold text-purple-800 dark:text-purple-300">
                      {DIFF_LABEL[bonusLevel.difficulty]}
                    </span>
                  </span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
