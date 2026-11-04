import { Cloud } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="Nublue">
      <div
        className="flex size-10 items-center justify-center rounded-[14px] text-primary-foreground shadow-lg shadow-primary/25"
        style={{ background: "var(--gradient-brand)" }}
      >
        <Cloud size={21} strokeWidth={2.8} />
      </div>
      {!compact && (
        <span className="text-xl font-black tracking-[-0.04em] text-foreground">nublue</span>
      )}
    </div>
  );
}
