import { AnimatePresence, motion } from "motion/react";
import { Heart, RotateCcw, Trophy } from "lucide-react";

const ICONS = {
  lives: Heart,
  "challenge-reset": RotateCcw,
  achievement: Trophy,
};

/** Avisos que aparecem no topo da tela e somem sozinhos. */
export function Notices({ notices, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md flex-col gap-2"
      aria-live="polite"
    >
      <AnimatePresence>
        {notices.map((notice) => {
          const Icon = ICONS[notice.kind] ?? Heart;
          return (
            <motion.button
              key={notice.id}
              type="button"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              onClick={() => onDismiss(notice.id)}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--landing-puzzle-border)] bg-card px-4 py-3 text-left shadow-lg dark:border-accent/40"
              aria-label={`${notice.title}. ${notice.text}. Fechar aviso`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-hero-badge-background)] dark:bg-accent/20">
                {notice.emoji ? (
                  <span className="text-lg" aria-hidden="true">
                    {notice.emoji}
                  </span>
                ) : (
                  <Icon
                    size={18}
                    className={
                      notice.kind === "lives"
                        ? "fill-red-500 text-red-500"
                        : "text-primary"
                    }
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground">
                  {notice.title}
                </span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  {notice.text}
                </span>
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
