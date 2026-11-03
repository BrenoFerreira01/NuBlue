import { motion } from "motion/react";
import { BookOpen, Check, Lock } from "lucide-react";
import { clsx } from "clsx";
import type { Level, LockedStub } from "../../types/game";
import { DIFF_CHIP, DIFF_LABEL, LOCKED_STUBS } from "../../data/levels";

export function SkillPathTab({
  levels, completedLevels, onStartLevel,
}: {
  levels: Level[];
  completedLevels: number[];
  onStartLevel: (l: Level) => void;
}) {
  const allNodes: (Level | LockedStub)[] = [...levels, ...LOCKED_STUBS];

  function isLevel(n: Level | LockedStub): n is Level {
    return "answers" in n;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Chapter card */}
      <div className="px-4 pt-4 pb-2">
        <div
          className="rounded-2xl px-4 py-4 border border-accent/45"
          style={{ background: "var(--surface-glass-strong)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={13} className="text-muted-foreground" />
            <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Capítulo 1</span>
          </div>
          <h1 className="text-xl font-black text-foreground">Cruzadinhas de Matemática</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Equações cruzadas · Preencha os números que faltam
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(completedLevels.length / levels.length) * 100}%`,
                  background: "var(--gradient-progress)",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-bold">
              {completedLevels.length}/{levels.length}
            </span>
          </div>
        </div>
      </div>

      {/* Skill path */}
      <div className="relative px-4 pb-8">
        <div className="relative max-w-sm mx-auto pt-4 pb-8">
          <div className="absolute left-1/2 top-10 bottom-10 -translate-x-px w-px border-l-2 border-dashed border-secondary" />
          <div className="flex flex-col gap-6">
            {allNodes.map((node, idx) => {
              const locked =
                !isLevel(node) ||
                (idx > 0 && !completedLevels.includes(allNodes[idx - 1].id));
              const completed = completedLevels.includes(node.id);
              const current = !completed && !locked;
              const alignRight = idx % 2 === 1;
              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07, type: "spring", stiffness: 200 }}
                  className={clsx("relative z-10 flex", alignRight ? "justify-end" : "justify-start")}
                >
                  <button
                    disabled={locked}
                    onClick={() => isLevel(node) && !locked && onStartLevel(node)}
                    className={clsx("flex flex-col items-center gap-2.5 group", locked && "cursor-default")}
                  >
                    <div className={clsx(
                      "w-[88px] h-[88px] rounded-[22px] flex items-center justify-center relative border-b-4 transition-all duration-200",
                      completed && "bg-emerald-500 border-emerald-700 shadow-xl shadow-emerald-500/30",
                      current && "bg-primary border-foreground shadow-2xl shadow-primary/50 group-hover:brightness-110",
                      locked && "bg-background border-secondary",
                    )}>
                      {completed ? (
                        <Check size={34} strokeWidth={3} className="text-white" />
                      ) : locked ? (
                        <Lock size={26} className="text-muted-foreground" />
                      ) : (
                        <span className="text-4xl">{node.emoji}</span>
                      )}
                      {current && (
                        <motion.div
                          className="absolute inset-0 rounded-[22px] border-2 border-white/25"
                          animate={{ opacity: [0.2, 0.7, 0.2] }}
                          transition={{ repeat: Infinity, duration: 2.5 }}
                        />
                      )}
                    </div>
                    <div className="text-center px-1">
                      <p className={clsx("font-black text-sm leading-tight", locked ? "text-muted-foreground" : "text-foreground")}>
                        {node.title}
                      </p>
                      <span className={clsx("text-xs font-bold rounded-full px-2 py-0.5 mt-0.5 inline-block", locked ? "text-muted-foreground" : DIFF_CHIP[node.difficulty])}>
                        {DIFF_LABEL[node.difficulty]}
                      </span>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
