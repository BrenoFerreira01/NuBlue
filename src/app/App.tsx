import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, Flame, Lock, Check, Trophy, User,
  Home as HomeIcon, ArrowLeft, Zap, Star, BookOpen,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "home" | "puzzle" | "result";
type Difficulty = "easy" | "medium" | "hard";
type CellStatus = "correct" | "wrong" | null;

interface GridCell {
  type: "number" | "operator" | "equals";
  value?: number | string;
  inputId?: string;
  isVertical?: boolean;
}

interface Level {
  id: number;
  title: string;
  subtitle: string;
  difficulty: Difficulty;
  xpReward: number;
  emoji: string;
  grid: (GridCell | null)[][];
  bank: number[];
  answers: Record<string, number>;
}

interface LockedStub {
  id: number;
  title: string;
  difficulty: Difficulty;
  emoji: string;
  isLocked: true;
}

// ── Puzzle Data ───────────────────────────────────────────────────────────────
// Each level has horizontal and vertical equations that share cells (crossword style).
// Answers for Level 1 — a=5, b=4: row0: 5+3=8 ✓  row2: 2+4=6 ✓  col0: 5+2=7 ✓  col2: 3+4=7 ✓
// Answers for Level 2 — c=5, d=2: row0: 5×4=20 ✓  row2: 3+2=5 ✓  col0: 5+3=8 ✓  col2: 4−2=2 ✓
// Answers for Level 3 — e=3, f=4, g=5: row0: 3×4=12 ✓  row2: 5+2=7 ✓  col0: 3+5=8 ✓  col2: 4−2=2 ✓

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Somando Certo",
    subtitle: "Descubra os números perdidos",
    difficulty: "easy",
    xpReward: 10,
    emoji: "⭐",
    grid: [
      [
        { type: "number", inputId: "a" },
        { type: "operator", value: "+" },
        { type: "number", value: 3 },
        { type: "equals" },
        { type: "number", value: 8 },
      ],
      [
        { type: "operator", value: "+", isVertical: true },
        null,
        { type: "operator", value: "+", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", value: 2 },
        { type: "operator", value: "+" },
        { type: "number", inputId: "b" },
        { type: "equals" },
        { type: "number", value: 6 },
      ],
      [
        { type: "equals", isVertical: true },
        null,
        { type: "equals", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", value: 7 },
        null,
        { type: "number", value: 7 },
        null,
        null,
      ],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    answers: { a: 5, b: 4 },
  },
  {
    id: 2,
    title: "Operações Mistas",
    subtitle: "Multiplicação e adição juntas",
    difficulty: "medium",
    xpReward: 20,
    emoji: "💫",
    grid: [
      [
        { type: "number", inputId: "c" },
        { type: "operator", value: "×" },
        { type: "number", value: 4 },
        { type: "equals" },
        { type: "number", value: 20 },
      ],
      [
        { type: "operator", value: "+", isVertical: true },
        null,
        { type: "operator", value: "−", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", value: 3 },
        { type: "operator", value: "+" },
        { type: "number", inputId: "d" },
        { type: "equals" },
        { type: "number", value: 5 },
      ],
      [
        { type: "equals", isVertical: true },
        null,
        { type: "equals", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", value: 8 },
        null,
        { type: "number", value: 2 },
        null,
        null,
      ],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8],
    answers: { c: 5, d: 2 },
  },
  {
    id: 3,
    title: "Triplo Desafio",
    subtitle: "Três incógnitas para resolver",
    difficulty: "hard",
    xpReward: 35,
    emoji: "🔥",
    grid: [
      [
        { type: "number", inputId: "e" },
        { type: "operator", value: "×" },
        { type: "number", inputId: "f" },
        { type: "equals" },
        { type: "number", value: 12 },
      ],
      [
        { type: "operator", value: "+", isVertical: true },
        null,
        { type: "operator", value: "−", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", inputId: "g" },
        { type: "operator", value: "+" },
        { type: "number", value: 2 },
        { type: "equals" },
        { type: "number", value: 7 },
      ],
      [
        { type: "equals", isVertical: true },
        null,
        { type: "equals", isVertical: true },
        null,
        null,
      ],
      [
        { type: "number", value: 8 },
        null,
        { type: "number", value: 2 },
        null,
        null,
      ],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    answers: { e: 3, f: 4, g: 5 },
  },
];

const LOCKED_STUBS: LockedStub[] = [
  { id: 4, title: "Divisão em Ação", difficulty: "medium", emoji: "➗", isLocked: true },
  { id: 5, title: "Grande Mestre", difficulty: "hard", emoji: "🏆", isLocked: true },
];

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};
const DIFF_CHIP: Record<Difficulty, string> = {
  easy: "bg-emerald-500/20 text-emerald-400",
  medium: "bg-amber-500/20 text-amber-400",
  hard: "bg-red-500/20 text-red-400",
};

// ── Grid Cell Component ───────────────────────────────────────────────────────

function Cell({
  cell,
  fill,
  status,
  canReceive,
  onClick,
}: {
  cell: GridCell | null;
  fill?: number | null;
  status?: CellStatus;
  canReceive?: boolean;
  onClick?: () => void;
}) {
  if (!cell) {
    return <div className="w-12 h-12 flex-shrink-0 md:w-14 md:h-14" />;
  }

  if (cell.type === "operator" || cell.type === "equals") {
    const sym = cell.type === "equals" ? "=" : String(cell.value);
    return (
      <div
        className={clsx(
          "w-12 h-12 flex-shrink-0 flex items-center justify-center select-none font-black md:w-14 md:h-14",
          cell.isVertical
            ? "text-base text-[#5040a0]"
            : "text-2xl text-[#9080cc]",
        )}
      >
        {sym}
      </div>
    );
  }

  // Pre-filled number tile (cream/golden — physical tile aesthetic)
  if (!cell.inputId) {
    return (
      <div
        className={clsx(
          "w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center",
          "font-black text-xl select-none",
          "bg-[#f4e5bc] text-[#1a0840] border-b-4 border-[#c8a060] shadow-sm",
          "md:w-14 md:h-14 md:text-2xl md:rounded-2xl",
        )}
      >
        {cell.value}
      </div>
    );
  }

  // User-fillable input cell
  const filled = fill != null;
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onClick}
      className={clsx(
        "w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center",
        "font-black text-xl border-2 transition-colors duration-150 cursor-pointer",
        "md:w-14 md:h-14 md:text-2xl md:rounded-2xl",
        !filled && !canReceive && "bg-[#100840] border-[#5040ee] text-[#5040ee]",
        !filled && canReceive && "bg-[#1c1260] border-[#9070ff] text-[#9070ff] shadow-[0_0_12px_rgba(144,112,255,0.4)]",
        filled && status === null && "bg-[#5040ff] border-[#7060ff] text-white shadow-[0_0_12px_rgba(80,64,255,0.45)]",
        filled && status === "correct" && "bg-emerald-500 border-emerald-400 text-white",
        filled && status === "wrong" && "bg-red-500 border-red-400 text-white",
      )}
    >
      {filled ? fill : "?"}
    </motion.button>
  );
}

// ── Puzzle Screen ─────────────────────────────────────────────────────────────

function PuzzleScreen({
  level,
  fills,
  selectedBank,
  hearts,
  cellStatuses,
  hasChecked,
  canCheck,
  onCellClick,
  onBankClick,
  onCheck,
  onBack,
}: {
  level: Level;
  fills: Record<string, number | null>;
  selectedBank: number | null;
  hearts: number;
  cellStatuses: Record<string, CellStatus>;
  hasChecked: boolean;
  canCheck: boolean;
  onCellClick: (id: string) => void;
  onBankClick: (n: number) => void;
  onCheck: () => void;
  onBack: () => void;
}) {
  const inputIds = Object.keys(level.answers);
  const filledCount = inputIds.filter((id) => fills[id] != null).length;
  const progress = inputIds.length > 0 ? filledCount / inputIds.length : 0;

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
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6050a0] hover:text-[#c0b0ff] hover:bg-[#1e1254] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 h-3 rounded-full bg-[#1a1050] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #5040ff, #c080ff)" }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 80 }}
          />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              size={18}
              className={
                i < hearts
                  ? "fill-red-500 text-red-500"
                  : "fill-[#1e1254] text-[#1e1254]"
              }
            />
          ))}
        </div>
      </div>

      {/* Level info */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={clsx("text-xs font-black rounded-full px-2 py-0.5", DIFF_CHIP[level.difficulty])}>
            {DIFF_LABEL[level.difficulty]}
          </span>
          <span className="text-xs text-[#5040a0] font-bold">+{level.xpReward} XP</span>
        </div>
        <h2 className="text-xl font-black text-white">{level.title}</h2>
        <p className="text-sm text-[#7060aa]">{level.subtitle}</p>
      </div>

      {/* Hint */}
      <div className="px-5 pb-3">
        <p className="text-xs text-[#5040a0]">
          Selecione um número abaixo e toque na célula{" "}
          <span className="text-[#8070cc] font-bold">?</span> para preencher
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 flex items-center justify-center px-4 py-2">
        <div
          className="relative rounded-3xl p-5"
          style={{ background: "rgba(26, 16, 80, 0.4)", backdropFilter: "blur(12px)" }}
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
                      selectedBank !== null &&
                      fills[cell.inputId!] == null
                    }
                    onClick={
                      cell?.inputId ? () => onCellClick(cell.inputId!) : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Number bank */}
      <div className="px-5 pb-3">
        <p className="text-xs font-black text-[#4030a0] uppercase tracking-widest text-center mb-3">
          Banco de Números
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {level.bank.map((num) => {
            const isSelected = selectedBank === num;
            const isUsed = Object.values(fills).includes(num);
            return (
              <motion.button
                key={num}
                whileTap={{ scale: 0.85 }}
                onClick={() => onBankClick(num)}
                disabled={hasChecked}
                className={clsx(
                  "w-12 h-12 rounded-xl font-black text-xl border-b-4 transition-all select-none",
                  isSelected
                    ? "bg-[#c080ff] border-[#9050cc] text-white shadow-lg shadow-[#c080ff]/40 scale-105"
                    : isUsed
                    ? "bg-[#120840] border-[#1e1050] text-[#3020608]"
                    : "bg-[#1e1254] border-[#382080] text-[#c8b8ff] hover:bg-[#2a1a7a]",
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
              ? "bg-[#5040ff] border-[#3020cc] text-white shadow-lg shadow-[#5040ff]/40 hover:bg-[#6050ff]"
              : "bg-[#1a1050] border-[#251570] text-[#3a2870] cursor-not-allowed",
          )}
        >
          Verificar Resposta
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────

function HomeScreen({
  levels,
  completedLevels,
  xp,
  streak,
  onStartLevel,
}: {
  levels: Level[];
  completedLevels: number[];
  xp: number;
  streak: number;
  onStartLevel: (l: Level) => void;
}) {
  const [activeTab, setActiveTab] = useState("home");

  const allNodes: (Level | LockedStub)[] = [...levels, ...LOCKED_STUBS];

  function isLevel(n: Level | LockedStub): n is Level {
    return "answers" in n;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Radial glow background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(80,64,255,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-[#1e1254]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-[#5040ff]/30"
            style={{ background: "linear-gradient(135deg, #5040ff 0%, #c080ff 100%)" }}
          >
            <span className="text-white font-black text-sm leading-none">N</span>
          </div>
          <span className="font-black text-lg text-white tracking-tight">nublue</span>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-[#1a1050] rounded-full px-3 py-1.5">
            <Flame size={14} className="fill-orange-400 text-orange-400" />
            <span className="text-sm font-black text-white">{streak}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1a1050] rounded-full px-3 py-1.5">
            <Zap size={14} className="fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-black text-white">{xp} XP</span>
          </div>
        </div>
      </div>

      {/* Chapter card */}
      <div className="relative px-4 pt-4 pb-2">
        <div
          className="rounded-2xl px-4 py-4 border border-[#3a2090]/30"
          style={{ background: "rgba(18, 8, 64, 0.8)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={13} className="text-[#c080ff]" />
            <span className="text-xs font-black text-[#c080ff] uppercase tracking-widest">
              Capítulo 1
            </span>
          </div>
          <h1 className="text-xl font-black text-white">
            Cuzadinhas de Matemática
          </h1>
          <p className="text-xs text-[#7060aa] mt-0.5">
            Equações cruzadas · Preencha os números que faltam
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-2 bg-[#2a1a6e] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(completedLevels.length / levels.length) * 100}%`,
                  background: "linear-gradient(90deg, #5040ff, #c080ff)",
                }}
              />
            </div>
            <span className="text-xs text-[#8070bb] font-bold">
              {completedLevels.length}/{levels.length}
            </span>
          </div>
        </div>
      </div>

      {/* Skill path */}
      <div className="relative flex-1 overflow-y-auto px-4 pb-4">
        <div className="relative max-w-sm mx-auto pt-4 pb-8">
          {/* Dotted trail */}
          <div className="absolute left-1/2 top-10 bottom-10 -translate-x-px w-px border-l-2 border-dashed border-[#2a1a6e]" />

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
                  className={clsx(
                    "relative z-10 flex",
                    alignRight ? "justify-end" : "justify-start",
                  )}
                >
                  <button
                    disabled={locked}
                    onClick={() =>
                      isLevel(node) && !locked && onStartLevel(node)
                    }
                    className={clsx(
                      "flex flex-col items-center gap-2.5 group",
                      locked && "cursor-default",
                    )}
                  >
                    <div
                      className={clsx(
                        "w-[88px] h-[88px] rounded-[22px] flex items-center justify-center relative border-b-4 transition-all duration-200",
                        completed &&
                          "bg-emerald-500 border-emerald-700 shadow-xl shadow-emerald-500/30",
                        current &&
                          "bg-[#5040ff] border-[#3020cc] shadow-2xl shadow-[#5040ff]/50 group-hover:brightness-110",
                        locked && "bg-[#140a3a] border-[#221660]",
                      )}
                    >
                      {completed ? (
                        <Check size={34} strokeWidth={3} className="text-white" />
                      ) : locked ? (
                        <Lock size={26} className="text-[#3a2a70]" />
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
                      <p
                        className={clsx(
                          "font-black text-sm leading-tight",
                          locked ? "text-[#3a2a70]" : "text-white",
                        )}
                      >
                        {node.title}
                      </p>
                      <span
                        className={clsx(
                          "text-xs font-bold rounded-full px-2 py-0.5 mt-0.5 inline-block",
                          locked ? "text-[#3a2a70]" : DIFF_CHIP[node.difficulty],
                        )}
                      >
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

      {/* Bottom nav */}
      <div className="relative flex border-t border-[#1a1050] bg-[#0a0428]">
        {[
          { id: "home", Icon: HomeIcon, label: "Início" },
          { id: "rank", Icon: Trophy, label: "Ranking" },
          { id: "profile", Icon: User, label: "Perfil" },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              "flex-1 flex flex-col items-center gap-1 py-3 transition-colors",
              activeTab === id ? "text-[#c080ff]" : "text-[#3a2a70]",
            )}
          >
            <Icon size={22} />
            <span className="text-xs font-black">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  level,
  isCorrect,
  xpEarned,
  onContinue,
  onRetry,
}: {
  level: Level;
  isCorrect: boolean;
  xpEarned: number;
  onContinue: () => void;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center"
    >
      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: isCorrect
            ? "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(34,197,94,0.12) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(80,64,255,0.1) 0%, transparent 70%)",
        }}
      />

      {/* Main icon */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
        className={clsx(
          "w-32 h-32 rounded-3xl flex items-center justify-center mb-5 relative",
          !isCorrect && "bg-[#140a3a] border-2 border-[#3a1a6a]",
        )}
        style={
          isCorrect
            ? {
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow: "0 24px 48px rgba(34,197,94,0.35)",
              }
            : {}
        }
      >
        {isCorrect ? (
          <Trophy size={58} className="text-white" />
        ) : (
          <span className="text-6xl">😔</span>
        )}
      </motion.div>

      {/* Stars — success only */}
      {isCorrect && (
        <div className="flex gap-3 mb-5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.09, type: "spring", stiffness: 260 }}
            >
              <Star size={36} className="fill-yellow-400 text-yellow-400" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-black text-white mb-2">
          {isCorrect ? "Incrível! 🎉" : "Quase lá..."}
        </h1>
        <p className="text-[#8070bb] text-base">
          {isCorrect
            ? "Você resolveu todas as equações!"
            : "Não desista! Você consegue na próxima."}
        </p>
      </motion.div>

      {/* XP card — success only */}
      {isCorrect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.32 }}
          className="flex items-center gap-3 rounded-2xl px-6 py-4 mb-8 border border-[#3a2090]/30 w-full max-w-xs"
          style={{ background: "rgba(18, 8, 64, 0.8)" }}
        >
          <Zap size={28} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-xs text-[#7060aa] font-black uppercase tracking-wide">
              XP Ganho
            </p>
            <p className="text-2xl font-black text-white">+{xpEarned} XP</p>
          </div>
        </motion.div>
      )}

      {/* Level info badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 mb-8"
      >
        <span className="text-2xl">{level.emoji}</span>
        <span className="text-[#8070bb] font-bold">{level.title}</span>
        <span
          className={clsx(
            "text-xs font-black rounded-full px-2 py-0.5",
            DIFF_CHIP[level.difficulty],
          )}
        >
          {DIFF_LABEL[level.difficulty]}
        </span>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="w-full max-w-xs space-y-3"
      >
        {isCorrect ? (
          <button
            onClick={onContinue}
            className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-[#3020cc] transition-all hover:brightness-110 active:border-b-0 active:translate-y-1"
            style={{ background: "#5040ff" }}
          >
            Continuar
          </button>
        ) : (
          <>
            <button
              onClick={onRetry}
              className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-[#3020cc] transition-all hover:brightness-110"
              style={{ background: "#5040ff" }}
            >
              Tentar Novamente
            </button>
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-2xl font-black text-lg text-[#8070bb] hover:text-white transition-colors"
              style={{ background: "rgba(26, 16, 80, 0.6)" }}
            >
              Voltar ao Início
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [currentLevel, setCurrentLevel] = useState<Level>(LEVELS[0]);
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [streak] = useState(7);

  const [fills, setFills] = useState<Record<string, number | null>>({});
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [hearts, setHearts] = useState(3);
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  function startLevel(level: Level) {
    setCurrentLevel(level);
    setFills({});
    setSelectedBank(null);
    setHearts(3);
    setCellStatuses({});
    setIsCorrect(false);
    setHasChecked(false);
    setScreen("puzzle");
  }

  function handleCellClick(inputId: string) {
    if (hasChecked) return;
    if (selectedBank !== null) {
      setFills((prev) => ({ ...prev, [inputId]: selectedBank }));
      setSelectedBank(null);
    } else {
      setFills((prev) => ({ ...prev, [inputId]: null }));
    }
  }

  function handleBankClick(num: number) {
    if (hasChecked) return;
    setSelectedBank((prev) => (prev === num ? null : num));
  }

  function checkAnswers() {
    if (hasChecked) return;
    const statuses: Record<string, CellStatus> = {};
    let allCorrect = true;
    for (const [id, answer] of Object.entries(currentLevel.answers)) {
      const correct = fills[id] === answer;
      statuses[id] = correct ? "correct" : "wrong";
      if (!correct) allCorrect = false;
    }
    setCellStatuses(statuses);
    setHasChecked(true);
    setIsCorrect(allCorrect);

    if (allCorrect) {
      setCompletedLevels((prev) => [...new Set([...prev, currentLevel.id])]);
      setTotalXp((prev) => prev + currentLevel.xpReward);
      setTimeout(() => setScreen("result"), 1300);
    } else {
      const newHearts = hearts - 1;
      setHearts(newHearts);
      if (newHearts <= 0) {
        setTimeout(() => setScreen("result"), 950);
      } else {
        setTimeout(() => {
          setCellStatuses({});
          setHasChecked(false);
        }, 1500);
      }
    }
  }

  const canCheck = Object.keys(currentLevel.answers).every(
    (id) => fills[id] != null,
  );

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {screen === "home" && (
          <HomeScreen
            key="home"
            levels={LEVELS}
            completedLevels={completedLevels}
            xp={totalXp}
            streak={streak}
            onStartLevel={startLevel}
          />
        )}
        {screen === "puzzle" && (
          <PuzzleScreen
            key="puzzle"
            level={currentLevel}
            fills={fills}
            selectedBank={selectedBank}
            hearts={hearts}
            cellStatuses={cellStatuses}
            hasChecked={hasChecked}
            canCheck={canCheck}
            onCellClick={handleCellClick}
            onBankClick={handleBankClick}
            onCheck={checkAnswers}
            onBack={() => setScreen("home")}
          />
        )}
        {screen === "result" && (
          <ResultScreen
            key="result"
            level={currentLevel}
            isCorrect={isCorrect}
            xpEarned={isCorrect ? currentLevel.xpReward : 0}
            onContinue={() => setScreen("home")}
            onRetry={() => startLevel(currentLevel)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
