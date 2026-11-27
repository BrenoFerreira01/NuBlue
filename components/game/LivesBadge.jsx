import { Heart } from "lucide-react";

/** "mm:ss" até `target` (ms). */
export function formatCountdown(target, now) {
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Vidas restantes e, quando faltam vidas, quanto falta para a próxima. */
export function LivesBadge({ lives, max, nextLifeAt, now, label = "vidas" }) {
  const regenerating = nextLifeAt !== null && lives < max;
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1.5 text-xs font-black sm:gap-1.5 sm:px-3 sm:text-sm"
      aria-label={
        regenerating
          ? `${lives} de ${max} ${label}. Próxima em ${formatCountdown(nextLifeAt, now)}`
          : `${lives} de ${max} ${label}`
      }
    >
      <Heart
        size={14}
        className={
          lives > 0
            ? "shrink-0 fill-red-500 text-red-500"
            : "shrink-0 text-muted-foreground"
        }
      />
      <span>{lives}</span>
      {regenerating && (
        <span className="font-bold tabular-nums text-muted-foreground">
          {formatCountdown(nextLifeAt, now)}
        </span>
      )}
    </div>
  );
}
