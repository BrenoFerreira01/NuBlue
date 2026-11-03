import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft, Heart, Swords } from "lucide-react";
import { clsx } from "clsx";
import type { CellStatus, Level } from "../../../types/game";
import { DIFF_CHIP, DIFF_LABEL } from "../../../data/levels";
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
  isChallenge, challengeRound,
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
  challengeRound: number;
  onCellClick: (id: string) => void;
  onBankClick: (n: number) => void;
  onDropNumber: (id: string, number: number) => void;
  onCheck: () => void;
  onBack: () => void;
}) {
  const inputIds = Object.keys(level.answers);
  const filledCount = inputIds.filter((id) => fills[id] != null).length;
  const progress = inputIds.length > 0 ? filledCount / inputIds.length : 0;
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
      className="min-h-screen flex flex-col bg-background max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-2">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 h-3 rounded-full bg-background overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gradient-progress)" }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 80 }}
          />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              size={18}
              className={i < hearts ? "fill-red-500 text-red-500" : "fill-[var(--secondary)] text-foreground"}
            />
          ))}
        </div>
      </div>

      {/* Challenge badge */}
      {isChallenge && (
        <div className="px-5 pt-2">
          <div className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/45 rounded-full px-3 py-1">
            <Swords size={12} className="text-muted-foreground" />
            <span className="text-xs font-black text-muted-foreground">
              Desafio · Rodada {challengeRound}
            </span>
          </div>
        </div>
      )}

      {/* Level info */}
      <div className="px-5 pt-2 pb-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={clsx("text-xs font-black rounded-full px-2 py-0.5", DIFF_CHIP[level.difficulty])}>
            {DIFF_LABEL[level.difficulty]}
          </span>
          <span className="text-xs text-muted-foreground font-bold">+{level.xpReward} XP</span>
        </div>
        <h2 className="text-xl font-black text-foreground">{level.title}</h2>
        <p className="text-sm text-muted-foreground">{level.subtitle}</p>
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs text-muted-foreground">
          Arraste um número ou selecione-o e escolha um espaço vazio.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <div
          className="relative rounded-3xl p-5"
          style={{ background: "var(--surface-glass-frosted)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex flex-col gap-1.5">
            {level.grid.map((row, ri) => (
              <div key={ri} className="flex gap-1.5 items-center">
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
      <div className="px-5 pb-3">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest text-center mb-3">
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
                  "w-12 h-12 rounded-xl font-black text-xl border-b-4 transition-all select-none touch-none cursor-grab active:cursor-grabbing",
                  isSelected
                    ? "bg-accent border-accent text-foreground shadow-lg shadow-accent/40 scale-105"
                    : isUsed
                    ? "bg-background border-secondary text-muted-foreground opacity-60"
                    : "bg-white border-secondary text-foreground hover:bg-secondary",
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
      <div className="px-5 pb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onCheck}
          disabled={!canCheck || hasChecked}
          className={clsx(
            "w-full py-4 rounded-2xl font-black text-lg border-b-4 transition-all",
            canCheck && !hasChecked
              ? "bg-primary border-foreground text-white shadow-lg shadow-primary/40 hover:bg-foreground"
              : "bg-background border-secondary text-muted-foreground cursor-not-allowed",
          )}
        >
          Verificar Resposta
        </motion.button>
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
