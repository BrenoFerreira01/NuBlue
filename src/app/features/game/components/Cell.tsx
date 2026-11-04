import { motion } from "motion/react";
import { clsx } from "clsx";
import type { CellStatus, GridCell } from "../../../types/game";

export function Cell({
  cell, fill, status, canReceive, onClick, dropTargetId,
}: {
  cell: GridCell | null;
  fill?: number | null;
  status?: CellStatus;
  canReceive?: boolean;
  onClick?: () => void;
  dropTargetId?: string;
}) {
  if (!cell) return <div className="size-10 flex-shrink-0 sm:size-12 md:size-14" />;

  if (cell.type === "operator" || cell.type === "equals") {
    const sym = cell.type === "equals" ? "=" : String(cell.value);
    return (
      <div className={clsx(
        "flex size-10 flex-shrink-0 select-none items-center justify-center font-black sm:size-12 md:size-14",
        cell.isVertical
          ? "text-xs text-muted-foreground sm:text-sm dark:text-[#5040a0]"
          : "text-lg text-muted-foreground sm:text-2xl dark:text-[#9080cc]",
      )}>
        {sym}
      </div>
    );
  }

  if (!cell.inputId) {
    return (
      <div className={clsx(
        "flex size-10 flex-shrink-0 select-none items-center justify-center rounded-lg",
        "border-b-4 border-accent bg-background font-black text-lg text-foreground shadow-sm dark:border-[#c8a060] dark:bg-[#f4e5bc] dark:text-[#1a0840]",
        "sm:size-12 sm:rounded-xl sm:text-xl md:size-14 md:rounded-2xl md:text-2xl",
      )}>
        {cell.value}
      </div>
    );
  }

  const filled = fill != null;
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onClick}
      data-drop-target={dropTargetId}
      aria-label={dropTargetId ? "Espaço vazio para colocar um número" : undefined}
      className={clsx(
        "flex size-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-2",
        "font-black text-lg transition-colors duration-150 sm:size-12 sm:rounded-xl sm:text-xl md:size-14 md:rounded-2xl md:text-2xl",
        !filled && !canReceive && "bg-card border-primary text-muted-foreground dark:bg-[#100840] dark:border-[#5040ee] dark:text-[#5040ee]",
        !filled && canReceive && "bg-secondary border-accent text-muted-foreground shadow-[var(--shadow-accent-glow)] ring-2 ring-accent/25 dark:bg-[#1c1260] dark:border-[#9070ff] dark:text-[#9070ff] dark:shadow-[0_0_12px_rgba(144,112,255,0.4)] dark:ring-0",
        filled && status === null && "bg-primary border-secondary text-white shadow-[var(--shadow-primary-glow)] dark:border-[#7060ff]",
        filled && status === "correct" && "bg-success border-success text-success-foreground dark:bg-emerald-500 dark:border-emerald-400 dark:text-white",
        filled && status === "wrong" && "bg-red-500 border-red-400 text-white",
      )}
    >
      {filled ? fill : "?"}
    </motion.button>
  );
}
