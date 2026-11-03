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
  if (!cell) return <div className="w-12 h-12 flex-shrink-0 md:w-14 md:h-14" />;

  if (cell.type === "operator" || cell.type === "equals") {
    const sym = cell.type === "equals" ? "=" : String(cell.value);
    return (
      <div className={clsx(
        "w-12 h-12 flex-shrink-0 flex items-center justify-center select-none font-black md:w-14 md:h-14",
        cell.isVertical ? "text-sm text-muted-foreground" : "text-2xl text-muted-foreground",
      )}>
        {sym}
      </div>
    );
  }

  if (!cell.inputId) {
    return (
      <div className={clsx(
        "w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center",
        "font-black text-xl select-none",
        "bg-background text-foreground border-b-4 border-accent shadow-sm",
        "md:w-14 md:h-14 md:text-2xl md:rounded-2xl",
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
        "w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center",
        "font-black text-xl border-2 transition-colors duration-150 cursor-pointer",
        "md:w-14 md:h-14 md:text-2xl md:rounded-2xl",
        !filled && !canReceive && "bg-white border-primary text-muted-foreground",
        !filled && canReceive && "bg-secondary border-accent text-muted-foreground shadow-[var(--shadow-accent-glow)] ring-2 ring-accent/25",
        filled && status === null && "bg-primary border-secondary text-white shadow-[var(--shadow-primary-glow)]",
        filled && status === "correct" && "bg-emerald-500 border-emerald-400 text-white",
        filled && status === "wrong" && "bg-red-500 border-red-400 text-white",
      )}
    >
      {filled ? fill : "?"}
    </motion.button>
  );
}
