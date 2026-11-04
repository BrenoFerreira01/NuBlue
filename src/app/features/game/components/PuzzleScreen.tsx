import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft, Heart, Sparkles, Swords } from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "../../../components/ThemeToggle";
import type { CellStatus, Level } from "../../../types/game";
import { CHAPTERS, DIFF_CHIP, DIFF_LABEL } from "../../../data/levels";
import { Cell } from "./Cell";

interface NumberDrag {
  pointerId: number;
  number: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

export function PuzzleScreen({
  level, fills, selectedBank, hearts, cellStatuses, hasChecked, canCheck,
  isChallenge, badgeLabel, progressOverride, showHearts = true, showLevelMeta = true, backLabel, secondaryAction, dark, onThemeChange,
  onCellClick, onBankClick, onDropNumber, onCheck, onBack,
}: {
  level: Level;
  fills: Record<string, number | null>;
  selectedBank: number | null;
  hearts: number;
  cellStatuses: Record<string, CellStatus>;
  hasChecked: boolean;
  canCheck: boolean;
  isChallenge: boolean;
  badgeLabel?: string;
  progressOverride?: number;
  showHearts?: boolean;
  showLevelMeta?: boolean;
  backLabel?: string;
  secondaryAction?: { label: string; onClick: () => void };
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  onCellClick: (id: string) => void;
  onBankClick: (n: number) => void;
  onDropNumber: (id: string, number: number) => void;
  onCheck: () => void;
  onBack: () => void;
}) {
  const inputIds = Object.keys(level.answers);
  const chapter = CHAPTERS.find((item) => item.id === level.chapter);
  const filledCount = inputIds.filter((id) => fills[id] != null).length;
  const progress = inputIds.length > 0 ? filledCount / inputIds.length : 0;
  const displayedProgress = progressOverride ?? progress;
  const pointerDrag = useRef<NumberDrag | null>(null);
  const dropNumberRef = useRef(onDropNumber);
  const suppressNextClick = useRef(false);
  const [dragPreview, setDragPreview] = useState<{ number: number; x: number; y: number } | null>(null);

  dropNumberRef.current = onDropNumber;

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = pointerDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) {
        return;
      }

      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      setDragPreview({ number: drag.number, x: drag.x, y: drag.y });
    }

    function handlePointerUp(event: PointerEvent) {
      const drag = pointerDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (drag.active) {
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-drop-target]");
        const inputId = target?.dataset.dropTarget;
        if (inputId) dropNumberRef.current(inputId, drag.number);

        suppressNextClick.current = true;
        window.setTimeout(() => {
          suppressNextClick.current = false;
        }, 0);
      }

      pointerDrag.current = null;
      setDragPreview(null);
    }

    function handlePointerCancel(event: PointerEvent) {
      if (pointerDrag.current?.pointerId !== event.pointerId) return;
      pointerDrag.current = null;
      setDragPreview(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  function handleGridCellClick(inputId: string) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    onCellClick(inputId);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.22 }}
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col overflow-x-hidden bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-4 sm:gap-3 sm:px-4 sm:pt-6">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel ?? (isChallenge ? "Voltar para desafios" : "Voltar à trilha")}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#6050a0] dark:hover:bg-[#1e1254] dark:hover:text-[#c0b0ff]"
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="h-3 flex-1 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-label={badgeLabel ?? "Progresso da cruzadinha"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayedProgress * 100)}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gradient-progress)" }}
            animate={{ width: `${displayedProgress * 100}%` }}
            transition={{ type: "spring", stiffness: 80 }}
          />
        </div>
        {showHearts && (
          <div className="flex shrink-0 gap-1 sm:gap-1.5" aria-label={`${hearts} tentativas restantes`}>
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                size={18}
                className={i < hearts ? "fill-red-500 text-red-500" : "fill-[var(--secondary)] text-foreground"}
              />
            ))}
          </div>
        )}
        <ThemeToggle dark={dark} onToggle={() => onThemeChange(!dark)} />
      </div>

      {/* Challenge badge */}
      {(isChallenge || badgeLabel) && (
        <div className="px-3 pt-2 sm:px-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/45 bg-accent/15 px-3 py-1 dark:border-[#c080ff]/30 dark:bg-[#c080ff]/15">
            {isChallenge
              ? <Swords size={12} className="text-muted-foreground dark:text-[#c080ff]" />
              : <Sparkles size={12} className="text-muted-foreground dark:text-[#c080ff]" />}
            <span className="text-xs font-black text-muted-foreground dark:text-[#c080ff]">
              {badgeLabel ?? "Desafio diário"}
            </span>
          </div>
        </div>
      )}

      {/* Level info */}
      <div className="px-3 pb-1 pt-2 sm:px-5">
        {showLevelMeta && (
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={clsx("text-xs font-black rounded-full px-2 py-0.5", DIFF_CHIP[level.difficulty])}>
              {DIFF_LABEL[level.difficulty]}
            </span>
            {chapter && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                Capítulo {chapter.id} — {chapter.title}
              </span>
            )}
            {level.xpReward > 0 && (
              <span className="text-xs text-muted-foreground font-bold">+{level.xpReward} XP</span>
            )}
          </div>
        )}
        <h2 className="text-xl font-black text-foreground">{level.title}</h2>
        <p className="text-sm text-muted-foreground">{level.subtitle}</p>
      </div>

      <div className="px-3 pb-3 sm:px-5">
        <p className="text-xs text-muted-foreground">
          Arraste um número ou selecione-o e escolha um espaço vazio.
        </p>
      </div>

      {/* Grid */}
      <div className="flex flex-1 items-center justify-center px-2 py-2 sm:px-4">
        <div
          className="relative max-w-full rounded-3xl p-3 sm:p-5"
          style={{ background: "var(--surface-glass-frosted)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex flex-col gap-1 sm:gap-1.5">
            {level.grid.map((row, ri) => (
              <div key={ri} className="flex items-center gap-1 sm:gap-1.5">
                {row.map((cell, ci) => (
                  <Cell
                    key={ci}
                    cell={cell}
                    fill={cell?.inputId ? fills[cell.inputId] : undefined}
                    status={cell?.inputId ? cellStatuses[cell.inputId] : undefined}
                    canReceive={
                      !!cell?.inputId &&
                      fills[cell.inputId] == null &&
                      !hasChecked &&
                      (selectedBank !== null || dragPreview !== null)
                    }
                    dropTargetId={
                      cell?.inputId && fills[cell.inputId] == null && !hasChecked
                        ? cell.inputId
                        : undefined
                    }
                    onClick={cell?.inputId ? () => handleGridCellClick(cell.inputId!) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Number bank */}
      <div className="px-3 pb-3 sm:px-5">
        <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-[#4030a0]">
          Banco de Números
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {level.bank.map((num, bankIdx) => {
            const isSelected = selectedBank === num;
            const isUsed = Object.values(fills).includes(num);
            return (
              <motion.button
                key={`${num}-${bankIdx}`}
                whileTap={{ scale: 0.85 }}
                onPointerDown={(event) => {
                  if (hasChecked) return;
                  pointerDrag.current = {
                    pointerId: event.pointerId,
                    number: num,
                    startX: event.clientX,
                    startY: event.clientY,
                    x: event.clientX,
                    y: event.clientY,
                    active: false,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onClick={() => {
                  if (suppressNextClick.current) {
                    suppressNextClick.current = false;
                    return;
                  }
                  onBankClick(num);
                }}
                disabled={hasChecked}
                aria-label={`Número ${num}. Arraste até um espaço vazio ou selecione para preencher.`}
                className={clsx(
                  "size-10 rounded-lg border-b-4 font-black text-lg transition-all select-none touch-none cursor-grab active:cursor-grabbing sm:size-12 sm:rounded-xl sm:text-xl",
                  isSelected
                    ? "bg-accent border-accent text-foreground shadow-lg shadow-accent/40 scale-105 dark:bg-[#c080ff] dark:border-[#9050cc] dark:text-white dark:shadow-[#c080ff]/40"
                    : isUsed
                    ? "bg-background border-secondary text-muted-foreground opacity-60 dark:bg-[#120840] dark:border-[#1e1050] dark:text-[#30208a] dark:opacity-100"
                    : "bg-card border-secondary text-foreground hover:bg-secondary dark:bg-[#1e1254] dark:border-[#382080] dark:text-[#c8b8ff] dark:hover:bg-[#2a1a7a]",
                  dragPreview?.number === num && "opacity-40",
                )}
              >
                {num}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Verify button */}
      <div className="px-3 pb-8 sm:px-5 sm:pb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onCheck}
          disabled={!canCheck || hasChecked}
          className={clsx(
            "w-full rounded-2xl border-b-4 py-4 text-base font-black transition-all sm:text-lg",
            canCheck && !hasChecked
              ? "bg-primary border-foreground text-white shadow-lg shadow-primary/40 hover:bg-foreground dark:bg-[#5040ff] dark:border-[#3020cc] dark:shadow-[#5040ff]/40 dark:hover:bg-[#6050ff]"
              : "bg-background border-secondary text-muted-foreground cursor-not-allowed dark:bg-[#1a1050] dark:border-[#251570] dark:text-[#3a2870]",
          )}
        >
          Verificar Resposta
        </motion.button>
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {dragPreview && typeof document !== "undefined" && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-b-4 border-accent bg-accent text-xl font-black text-foreground shadow-lg shadow-accent/40"
          style={{ left: dragPreview.x, top: dragPreview.y }}
        >
          {dragPreview.number}
        </div>,
        document.body,
      )}
    </motion.div>
  );
}
