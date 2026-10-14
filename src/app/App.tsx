import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart, Flame, Lock, Check, Trophy, User,
  Home as HomeIcon, ArrowLeft, Zap, Star, BookOpen,
  Swords, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "main" | "puzzle" | "result";
type TabId = "home" | "challenges" | "ranking" | "profile";
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

interface MockPlayer {
  id: number;
  name: string;
  xp: number;
  weeklyXp: number;
  streak: number;
  emoji: string;
}

// ── Static Level Data ─────────────────────────────────────────────────────────
// Answers: a=5 b=4 | c=5 d=2 | e=3 f=4 g=5

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Somando Certo",
    subtitle: "Descubra os números perdidos",
    difficulty: "easy",
    xpReward: 10,
    emoji: "⭐",
    grid: [
      [{ type: "number", inputId: "a" }, { type: "operator", value: "+" }, { type: "number", value: 3 }, { type: "equals" }, { type: "number", value: 8 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "+", isVertical: true }, null, null],
      [{ type: "number", value: 2 }, { type: "operator", value: "+" }, { type: "number", inputId: "b" }, { type: "equals" }, { type: "number", value: 6 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 7 }, null, { type: "number", value: 7 }, null, null],
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
      [{ type: "number", inputId: "c" }, { type: "operator", value: "×" }, { type: "number", value: 4 }, { type: "equals" }, { type: "number", value: 20 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "−", isVertical: true }, null, null],
      [{ type: "number", value: 3 }, { type: "operator", value: "+" }, { type: "number", inputId: "d" }, { type: "equals" }, { type: "number", value: 5 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 8 }, null, { type: "number", value: 2 }, null, null],
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
      [{ type: "number", inputId: "e" }, { type: "operator", value: "×" }, { type: "number", inputId: "f" }, { type: "equals" }, { type: "number", value: 12 }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "−", isVertical: true }, null, null],
      [{ type: "number", inputId: "g" }, { type: "operator", value: "+" }, { type: "number", value: 2 }, { type: "equals" }, { type: "number", value: 7 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: 8 }, null, { type: "number", value: 2 }, null, null],
    ],
    bank: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    answers: { e: 3, f: 4, g: 5 },
  },
];

const LOCKED_STUBS: LockedStub[] = [
  { id: 4, title: "Divisão em Ação", difficulty: "medium", emoji: "➗", isLocked: true },
  { id: 5, title: "Grande Mestre", difficulty: "hard", emoji: "🏆", isLocked: true },
];

const MOCK_PLAYERS: MockPlayer[] = [
  { id: 1, name: "Ana Oliveira", xp: 2840, weeklyXp: 340, streak: 23, emoji: "👩" },
  { id: 2, name: "Carlos Souza", xp: 2210, weeklyXp: 210, streak: 14, emoji: "👨" },
  { id: 3, name: "Beatriz Lima", xp: 1990, weeklyXp: 175, streak: 8, emoji: "👩" },
  { id: 4, name: "Diego Ferreira", xp: 1340, weeklyXp: 190, streak: 11, emoji: "🧑" },
  { id: 5, name: "Fernanda Costa", xp: 980, weeklyXp: 98, streak: 5, emoji: "👩" },
  { id: 6, name: "Gabriel Mendes", xp: 750, weeklyXp: 75, streak: 3, emoji: "👨" },
  { id: 7, name: "Helena Santos", xp: 620, weeklyXp: 62, streak: 7, emoji: "👩" },
  { id: 8, name: "Igor Rodrigues", xp: 410, weeklyXp: 41, streak: 2, emoji: "🧑" },
  { id: 9, name: "Juliana Barbosa", xp: 290, weeklyXp: 29, streak: 4, emoji: "👩" },
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

// ── Procedural Puzzle Generator ───────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function applyOp(a: number, b: number, op: string): number | null {
  switch (op) {
    case "+": return a + b;
    case "−": return a > b ? a - b : null;
    case "×": return a * b;
    case "÷": return b > 1 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function getRoundMeta(round: number): { subtitle: string; emoji: string; difficulty: Difficulty } {
  if (round <= 2) return { subtitle: "Adições simples", emoji: "⭐", difficulty: "easy" };
  if (round <= 4) return { subtitle: "Adição e subtração", emoji: "💫", difficulty: "easy" };
  if (round <= 7) return { subtitle: "Operações variadas", emoji: "🔥", difficulty: "medium" };
  if (round <= 11) return { subtitle: "Multiplicação intensa", emoji: "💎", difficulty: "hard" };
  return { subtitle: "Nível extremo", emoji: "🌪️", difficulty: "hard" };
}

function generatePuzzle(round: number): Level {
  const ops =
    round <= 2 ? ["+"] :
    round <= 5 ? ["+", "−"] :
    round <= 9 ? ["+", "−", "×"] :
    ["+", "−", "×", "÷"];

  const maxNum = Math.min(3 + round * 2, 24);
  const numBlanks = round <= 7 ? 2 : 3;
  const meta = getRoundMeta(round);

  for (let attempt = 0; attempt < 800; attempt++) {
    const a = rand(1, maxNum);
    const b = rand(1, maxNum);
    const c = rand(1, maxNum);
    const d = rand(1, maxNum);
    const h1 = ops[rand(0, ops.length - 1)];
    const h2 = ops[rand(0, ops.length - 1)];
    const v1 = ops[rand(0, ops.length - 1)];
    const v2 = ops[rand(0, ops.length - 1)];
    const rh1 = applyOp(a, b, h1);
    const rh2 = applyOp(c, d, h2);
    const rv1 = applyOp(a, c, v1);
    const rv2 = applyOp(b, d, v2);

    if (rh1 == null || rh2 == null || rv1 == null || rv2 == null) continue;
    if (rh1 <= 0 || rh2 <= 0 || rv1 <= 0 || rv2 <= 0) continue;
    if (rh1 > 60 || rh2 > 60 || rv1 > 60 || rv2 > 60) continue;

    const corners = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const blankPos = corners.slice(0, numBlanks);
    const vals = [a, b, c, d];
    const ids = ["p", "q", "r", "s"];
    const answers: Record<string, number> = {};
    blankPos.forEach((pos) => { answers[ids[pos]] = vals[pos]; });

    function mkCell(val: number, idx: number): GridCell {
      return blankPos.includes(idx)
        ? { type: "number", inputId: ids[idx] }
        : { type: "number", value: val };
    }

    const grid: (GridCell | null)[][] = [
      [mkCell(a, 0), { type: "operator", value: h1 }, mkCell(b, 1), { type: "equals" }, { type: "number", value: rh1 }],
      [{ type: "operator", value: v1, isVertical: true }, null, { type: "operator", value: v2, isVertical: true }, null, null],
      [mkCell(c, 2), { type: "operator", value: h2 }, mkCell(d, 3), { type: "equals" }, { type: "number", value: rh2 }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: rv1 }, null, { type: "number", value: rv2 }, null, null],
    ];

    const answerVals = Object.values(answers);
    const bankSet = new Set<number>(answerVals);
    let safety = 0;
    while (bankSet.size < 9 && safety < 200) {
      bankSet.add(rand(1, Math.max(maxNum + 5, 12)));
      safety++;
    }
    const bank = [...bankSet].sort(() => Math.random() - 0.5);

    return {
      id: -(round * 1000 + attempt),
      title: `Rodada ${round}`,
      subtitle: meta.subtitle,
      difficulty: meta.difficulty,
      xpReward: Math.floor(5 + round * 3),
      emoji: meta.emoji,
      grid,
      bank,
      answers,
    };
  }

  // Fallback: simple addition
  const a = rand(1, 5), b = rand(1, 5), c = rand(1, 5), d = rand(1, 5);
  return {
    id: -round,
    title: `Rodada ${round}`,
    subtitle: "Adições simples",
    difficulty: "easy",
    xpReward: 5,
    emoji: "⭐",
    grid: [
      [{ type: "number", inputId: "p" }, { type: "operator", value: "+" }, { type: "number", value: b }, { type: "equals" }, { type: "number", value: a + b }],
      [{ type: "operator", value: "+", isVertical: true }, null, { type: "operator", value: "+", isVertical: true }, null, null],
      [{ type: "number", value: c }, { type: "operator", value: "+" }, { type: "number", inputId: "s" }, { type: "equals" }, { type: "number", value: c + d }],
      [{ type: "equals", isVertical: true }, null, { type: "equals", isVertical: true }, null, null],
      [{ type: "number", value: a + c }, null, { type: "number", value: b + d }, null, null],
    ],
    bank: [...new Set([a, d, rand(1, 9), rand(1, 9), rand(1, 9), rand(1, 9)])].sort(() => Math.random() - 0.5),
    answers: { p: a, s: d },
  };
}

// ── Cell Component ─────────────────────────────────────────────────────────────

function Cell({
  cell, fill, status, canReceive, onClick,
}: {
  cell: GridCell | null;
  fill?: number | null;
  status?: CellStatus;
  canReceive?: boolean;
  onClick?: () => void;
}) {
  if (!cell) return <div className="w-12 h-12 flex-shrink-0 md:w-14 md:h-14" />;

  if (cell.type === "operator" || cell.type === "equals") {
    const sym = cell.type === "equals" ? "=" : String(cell.value);
    return (
      <div className={clsx(
        "w-12 h-12 flex-shrink-0 flex items-center justify-center select-none font-black md:w-14 md:h-14",
        cell.isVertical ? "text-sm text-[#5040a0]" : "text-2xl text-[#9080cc]",
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
        "bg-[#f4e5bc] text-[#1a0840] border-b-4 border-[#c8a060] shadow-sm",
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
  level, fills, selectedBank, hearts, cellStatuses, hasChecked, canCheck,
  isChallenge, challengeRound,
  onCellClick, onBankClick, onCheck, onBack,
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
              className={i < hearts ? "fill-red-500 text-red-500" : "fill-[#1e1254] text-[#1e1254]"}
            />
          ))}
        </div>
      </div>

      {/* Challenge badge */}
      {isChallenge && (
        <div className="px-5 pt-2">
          <div className="inline-flex items-center gap-1.5 bg-[#c080ff]/15 border border-[#c080ff]/30 rounded-full px-3 py-1">
            <Swords size={12} className="text-[#c080ff]" />
            <span className="text-xs font-black text-[#c080ff]">
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
          <span className="text-xs text-[#5040a0] font-bold">+{level.xpReward} XP</span>
        </div>
        <h2 className="text-xl font-black text-white">{level.title}</h2>
        <p className="text-sm text-[#7060aa]">{level.subtitle}</p>
      </div>

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
                      !!cell?.inputId && selectedBank !== null && fills[cell.inputId!] == null
                    }
                    onClick={cell?.inputId ? () => onCellClick(cell.inputId!) : undefined}
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
          {level.bank.map((num, bankIdx) => {
            const isSelected = selectedBank === num;
            const isUsed = Object.values(fills).includes(num);
            return (
              <motion.button
                key={`${num}-${bankIdx}`}
                whileTap={{ scale: 0.85 }}
                onClick={() => onBankClick(num)}
                disabled={hasChecked}
                className={clsx(
                  "w-12 h-12 rounded-xl font-black text-xl border-b-4 transition-all select-none",
                  isSelected
                    ? "bg-[#c080ff] border-[#9050cc] text-white shadow-lg shadow-[#c080ff]/40 scale-105"
                    : isUsed
                    ? "bg-[#120840] border-[#1e1050] text-[#30208a]"
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

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  level, isCorrect, xpEarned,
  isChallenge, challengeRound,
  onContinue, onRetry, onNextRound, onEndChallenge,
}: {
  level: Level;
  isCorrect: boolean;
  xpEarned: number;
  isChallenge: boolean;
  challengeRound: number;
  onContinue: () => void;
  onRetry: () => void;
  onNextRound: () => void;
  onEndChallenge: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: isCorrect
            ? "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(34,197,94,0.12) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(239,68,68,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, delay: 0.05 }}
        className={clsx(
          "w-32 h-32 rounded-3xl flex items-center justify-center mb-5",
          !isCorrect && "bg-[#140a3a] border-2 border-[#3a1a6a]",
        )}
        style={
          isCorrect
            ? { background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", boxShadow: "0 24px 48px rgba(34,197,94,0.35)" }
            : {}
        }
      >
        {isCorrect ? <Trophy size={58} className="text-white" /> : <span className="text-6xl">😔</span>}
      </motion.div>

      {/* Stars on success */}
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
        className="mb-5"
      >
        {isChallenge ? (
          isCorrect ? (
            <>
              <h1 className="text-3xl font-black text-white mb-1">Rodada {challengeRound} concluída!</h1>
              <p className="text-[#8070bb]">Pronto para o próximo desafio?</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-white mb-1">Sequência encerrada!</h1>
              <p className="text-[#8070bb]">
                Você chegou até a <span className="text-white font-black">Rodada {challengeRound}</span>
              </p>
            </>
          )
        ) : (
          isCorrect ? (
            <>
              <h1 className="text-3xl font-black text-white mb-1">Incrível! 🎉</h1>
              <p className="text-[#8070bb]">Você resolveu todas as equações!</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-white mb-1">Quase lá...</h1>
              <p className="text-[#8070bb]">Não desista! Você consegue.</p>
            </>
          )
        )}
      </motion.div>

      {/* XP card */}
      {xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.32 }}
          className="flex items-center gap-3 rounded-2xl px-6 py-4 mb-6 border border-[#3a2090]/30 w-full max-w-xs"
          style={{ background: "rgba(18, 8, 64, 0.8)" }}
        >
          <Zap size={28} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-xs text-[#7060aa] font-black uppercase tracking-wide">XP Ganho</p>
            <p className="text-2xl font-black text-white">+{xpEarned} XP</p>
          </div>
        </motion.div>
      )}

      {/* Challenge round badge */}
      {isChallenge && !isCorrect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38 }}
          className="flex items-center gap-2 mb-6"
        >
          <Swords size={18} className="text-[#c080ff]" />
          <span className="text-[#8070bb] font-bold">Melhor resultado: Rodada {challengeRound}</span>
        </motion.div>
      )}

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="w-full max-w-xs space-y-3"
      >
        {isChallenge ? (
          isCorrect ? (
            <>
              <button
                onClick={onNextRound}
                className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-[#3020cc] transition-all hover:brightness-110 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                style={{ background: "#5040ff" }}
              >
                Próxima Rodada <ChevronRight size={20} />
              </button>
              <button
                onClick={onEndChallenge}
                className="w-full py-4 rounded-2xl font-black text-lg text-[#8070bb] hover:text-white transition-colors"
                style={{ background: "rgba(26, 16, 80, 0.6)" }}
              >
                Encerrar Desafio
              </button>
            </>
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
                onClick={onEndChallenge}
                className="w-full py-4 rounded-2xl font-black text-lg text-[#8070bb] hover:text-white transition-colors"
                style={{ background: "rgba(26, 16, 80, 0.6)" }}
              >
                Voltar
              </button>
            </>
          )
        ) : (
          isCorrect ? (
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
          )
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Skill Path Tab ─────────────────────────────────────────────────────────────

function SkillPathTab({
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
          className="rounded-2xl px-4 py-4 border border-[#3a2090]/30"
          style={{ background: "rgba(18, 8, 64, 0.8)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={13} className="text-[#c080ff]" />
            <span className="text-xs font-black text-[#c080ff] uppercase tracking-widest">Capítulo 1</span>
          </div>
          <h1 className="text-xl font-black text-white">Cruzadinhas de Matemática</h1>
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
      <div className="relative px-4 pb-8">
        <div className="relative max-w-sm mx-auto pt-4 pb-8">
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
                      current && "bg-[#5040ff] border-[#3020cc] shadow-2xl shadow-[#5040ff]/50 group-hover:brightness-110",
                      locked && "bg-[#140a3a] border-[#221660]",
                    )}>
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
                      <p className={clsx("font-black text-sm leading-tight", locked ? "text-[#3a2a70]" : "text-white")}>
                        {node.title}
                      </p>
                      <span className={clsx("text-xs font-bold rounded-full px-2 py-0.5 mt-0.5 inline-block", locked ? "text-[#3a2a70]" : DIFF_CHIP[node.difficulty])}>
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

// ── Challenges Tab ─────────────────────────────────────────────────────────────

function ChallengesTab({
  bestRound, onStartChallenge,
}: {
  bestRound: number;
  onStartChallenge: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Hero card */}
      <div
        className="rounded-2xl p-5 border border-[#c080ff]/20 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(80,64,255,0.25) 0%, rgba(192,128,255,0.15) 100%)" }}
      >
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10"
          style={{ background: "radial-gradient(#c080ff, transparent)" }} />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#c080ff]/20 flex items-center justify-center">
            <Swords size={20} className="text-[#c080ff]" />
          </div>
          <div>
            <h2 className="font-black text-white text-lg">Desafio Diário</h2>
            <p className="text-xs text-[#9080cc]">Cruzadinhas progressivas</p>
          </div>
        </div>
        <p className="text-sm text-[#9080cc] leading-relaxed">
          Resolva cruzadinhas matemáticas cada vez mais difíceis. A dificuldade aumenta suavemente a cada rodada — até você perder!
        </p>
      </div>

      {/* Best score */}
      <div
        className="rounded-2xl p-4 border border-[#3a2090]/30 flex items-center gap-4"
        style={{ background: "rgba(18, 8, 64, 0.8)" }}
      >
        <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
          <Trophy size={22} className="text-yellow-400" />
        </div>
        <div>
          <p className="text-xs text-[#6050a0] font-black uppercase tracking-wide">Melhor Sequência</p>
          {bestRound > 0 ? (
            <p className="text-2xl font-black text-white">
              Rodada {bestRound}
              <span className="text-sm text-[#8070bb] font-bold ml-2">🏆 Recorde</span>
            </p>
          ) : (
            <p className="text-lg font-bold text-[#4030a0]">Ainda sem recorde</p>
          )}
        </div>
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl p-4 border border-[#3a2090]/20"
        style={{ background: "rgba(18, 8, 64, 0.6)" }}
      >
        <p className="text-xs font-black text-[#c080ff] uppercase tracking-widest mb-3">Como funciona</p>
        {[
          { emoji: "🧩", text: "Cada rodada gera uma cruzadinha matemática única" },
          { emoji: "📈", text: "A dificuldade aumenta sutilmente a cada rodada" },
          { emoji: "❤️", text: "Você tem 3 tentativas por rodada" },
          { emoji: "💀", text: "3 erros e o desafio termina" },
          { emoji: "🏆", text: "Tente superar seu próprio recorde!" },
        ].map(({ emoji, text }) => (
          <div key={text} className="flex items-start gap-3 mb-2.5 last:mb-0">
            <span className="text-base flex-shrink-0">{emoji}</span>
            <p className="text-sm text-[#8070bb]">{text}</p>
          </div>
        ))}
      </div>

      {/* Difficulty progression */}
      <div
        className="rounded-2xl p-4 border border-[#3a2090]/20"
        style={{ background: "rgba(18, 8, 64, 0.6)" }}
      >
        <p className="text-xs font-black text-[#c080ff] uppercase tracking-widest mb-3">Progressão de Dificuldade</p>
        <div className="space-y-2">
          {[
            { range: "Rodadas 1–2", label: "Adição", color: "bg-emerald-500" },
            { range: "Rodadas 3–5", label: "+ Subtração", color: "bg-yellow-500" },
            { range: "Rodadas 6–9", label: "+ Multiplicação", color: "bg-orange-500" },
            { range: "Rodadas 10+", label: "+ Divisão", color: "bg-red-500" },
          ].map(({ range, label, color }) => (
            <div key={range} className="flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full flex-shrink-0", color)} />
              <span className="text-xs text-[#6050a0] w-28 font-bold">{range}</span>
              <span className="text-xs text-[#9080cc]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Start button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onStartChallenge}
        className="w-full py-4 rounded-2xl font-black text-lg text-white border-b-4 border-[#9050cc] transition-all hover:brightness-110 flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #6040ff, #c080ff)" }}
      >
        <Swords size={20} />
        Iniciar Desafio
      </motion.button>
    </div>
  );
}

// ── Ranking Tab ───────────────────────────────────────────────────────────────

function RankingTab({ userXp, userStreak }: { userXp: number; userStreak: number }) {
  const [tab, setTab] = useState<"weekly" | "all">("weekly");

  const leaderboard = useMemo(() => {
    const userXpVal = userXp;
    const all = [
      ...MOCK_PLAYERS.map((p) => ({
        ...p,
        score: tab === "weekly" ? p.weeklyXp : p.xp,
        isUser: false,
      })),
      { id: 0, name: "Você", score: userXpVal, streak: userStreak, emoji: "🧑‍💻", isUser: true, xp: userXp, weeklyXp: userXp },
    ];
    return all.sort((a, b) => b.score - a.score);
  }, [tab, userXp, userStreak]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={22} className="text-yellow-400" />
          <h2 className="text-xl font-black text-white">Ranking</h2>
        </div>
        {/* Toggle */}
        <div className="flex bg-[#1a1050] rounded-xl p-1">
          {(["weekly", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex-1 py-2 rounded-lg font-black text-sm transition-all",
                tab === t ? "bg-[#5040ff] text-white shadow-lg" : "text-[#6050a0]",
              )}
            >
              {t === "weekly" ? "Esta Semana" : "Geral"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 pb-8 space-y-2">
        {leaderboard.map((player, idx) => {
          const isUser = player.isUser;
          const rank = idx + 1;
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={clsx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all",
                isUser
                  ? "border-[#5040ff]/50 shadow-lg shadow-[#5040ff]/15"
                  : "border-[#2a1a6e]/40",
              )}
              style={{
                background: isUser
                  ? "rgba(80, 64, 255, 0.15)"
                  : "rgba(18, 8, 64, 0.7)",
              }}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {rank <= 3 ? (
                  <span className="text-xl">{medals[rank - 1]}</span>
                ) : (
                  <span className="text-sm font-black text-[#5040a0]">{rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl",
                isUser ? "bg-[#5040ff]/30" : "bg-[#1e1254]",
              )}>
                {player.emoji}
              </div>

              {/* Name + streak */}
              <div className="flex-1 min-w-0">
                <p className={clsx("font-black text-sm truncate", isUser ? "text-white" : "text-[#c8b8ff]")}>
                  {player.name}
                  {isUser && <span className="text-[#c080ff] ml-1">· Você</span>}
                </p>
                <div className="flex items-center gap-1">
                  <Flame size={11} className="text-orange-400 fill-orange-400" />
                  <span className="text-xs text-[#6050a0] font-bold">{player.streak} dias</span>
                </div>
              </div>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Zap size={13} className="fill-yellow-400 text-yellow-400" />
                  <span className={clsx("font-black text-sm", isUser ? "text-white" : "text-[#c8b8ff]")}>
                    {player.score.toLocaleString("pt-BR")}
                  </span>
                </div>
                <span className="text-xs text-[#5040a0]">XP</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────────────────────

function ProfileTab({
  xp, streak, completedLevels, bestRound, totalSolved,
}: {
  xp: number;
  streak: number;
  completedLevels: number[];
  bestRound: number;
  totalSolved: number;
}) {
  const userLevel = Math.floor(xp / 50) + 1;
  const xpInLevel = xp % 50;
  const progressPct = (xpInLevel / 50) * 100;

  const achievements = [
    {
      emoji: "🏁",
      name: "Primeiro Passo",
      desc: "Complete qualquer nível",
      unlocked: completedLevels.length >= 1,
    },
    {
      emoji: "🎓",
      name: "Cruzadinha Mestre",
      desc: "Complete todos os níveis base",
      unlocked: completedLevels.length >= 3,
    },
    {
      emoji: "⚔️",
      name: "Desafiador",
      desc: "Alcance a Rodada 5 no Desafio",
      unlocked: bestRound >= 5,
    },
    {
      emoji: "🔥",
      name: "Em Chamas",
      desc: "Mantenha 7 dias de sequência",
      unlocked: streak >= 7,
    },
    {
      emoji: "💎",
      name: "Colecionador de XP",
      desc: "Acumule 100 XP no total",
      unlocked: xp >= 100,
    },
    {
      emoji: "🌪️",
      name: "Imparável",
      desc: "Alcance a Rodada 10 no Desafio",
      unlocked: bestRound >= 10,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Profile card */}
      <div
        className="rounded-2xl p-5 border border-[#3a2090]/30 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(80,64,255,0.2) 0%, rgba(18,8,64,0.9) 100%)" }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(#c080ff, transparent)" }} />
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #5040ff, #c080ff)" }}
          >
            🧑‍💻
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Jogador</h2>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <Flame size={13} className="fill-orange-400 text-orange-400" />
                <span className="text-xs font-black text-white">{streak} dias</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={13} className="fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-black text-white">{xp} XP</span>
              </div>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 bg-[#5040ff]/30 rounded-full px-2 py-0.5">
              <Star size={11} className="fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-black text-white">Nível {userLevel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Níveis", value: `${completedLevels.length}/${LEVELS.length}`, icon: "📚" },
          { label: "Melhor Desafio", value: bestRound > 0 ? `Rd. ${bestRound}` : "—", icon: "⚔️" },
          { label: "Resolvidas", value: String(totalSolved), icon: "✅" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="rounded-2xl p-3 border border-[#2a1a6e]/40 text-center"
            style={{ background: "rgba(18, 8, 64, 0.7)" }}
          >
            <span className="text-2xl block mb-1">{icon}</span>
            <p className="text-lg font-black text-white leading-none">{value}</p>
            <p className="text-xs text-[#6050a0] mt-0.5 font-bold">{label}</p>
          </div>
        ))}
      </div>

      {/* XP Progress */}
      <div
        className="rounded-2xl p-4 border border-[#2a1a6e]/40"
        style={{ background: "rgba(18, 8, 64, 0.7)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-[#c080ff] uppercase tracking-widest">Progresso XP</p>
          <p className="text-xs text-[#6050a0] font-bold">Nível {userLevel} → {userLevel + 1}</p>
        </div>
        <div className="h-3 bg-[#2a1a6e] rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #5040ff, #c080ff)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, type: "spring" }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-[#6050a0]">{xpInLevel} XP</span>
          <span className="text-xs text-[#6050a0]">50 XP</span>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <p className="text-xs font-black text-[#c080ff] uppercase tracking-widest mb-3 px-1">
          Conquistas
        </p>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                "rounded-2xl p-3 border transition-all",
                a.unlocked
                  ? "border-[#c080ff]/30 shadow-sm shadow-[#c080ff]/10"
                  : "border-[#1e1254]/60",
              )}
              style={{
                background: a.unlocked
                  ? "rgba(192, 128, 255, 0.1)"
                  : "rgba(10, 5, 30, 0.6)",
              }}
            >
              <span className={clsx("text-2xl block mb-1.5", !a.unlocked && "grayscale opacity-30")}>
                {a.emoji}
              </span>
              <p className={clsx("font-black text-xs", a.unlocked ? "text-white" : "text-[#3a2a70]")}>
                {a.name}
              </p>
              <p className={clsx("text-xs mt-0.5", a.unlocked ? "text-[#9080cc]" : "text-[#2a1a60]")}>
                {a.desc}
              </p>
              {a.unlocked && (
                <div className="mt-1.5 flex items-center gap-1">
                  <Check size={11} className="text-emerald-400" strokeWidth={3} />
                  <span className="text-xs text-emerald-400 font-bold">Conquistada</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

function MainScreen({
  activeTab, setActiveTab, levels, completedLevels, xp, streak,
  bestRound, totalSolved, onStartLevel, onStartChallenge,
}: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  levels: Level[];
  completedLevels: number[];
  xp: number;
  streak: number;
  bestRound: number;
  totalSolved: number;
  onStartLevel: (l: Level) => void;
  onStartChallenge: () => void;
}) {
  const navItems: { id: TabId; Icon: typeof HomeIcon; label: string }[] = [
    { id: "home", Icon: HomeIcon, label: "Aprender" },
    { id: "challenges", Icon: Swords, label: "Desafio" },
    { id: "ranking", Icon: Trophy, label: "Ranking" },
    { id: "profile", Icon: User, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(80,64,255,0.15) 0%, transparent 70%)" }}
      />

      {/* Shared header */}
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

      {/* Tab content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SkillPathTab
                levels={levels}
                completedLevels={completedLevels}
                onStartLevel={onStartLevel}
              />
            </motion.div>
          )}
          {activeTab === "challenges" && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ChallengesTab bestRound={bestRound} onStartChallenge={onStartChallenge} />
            </motion.div>
          )}
          {activeTab === "ranking" && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <RankingTab userXp={xp} userStreak={streak} />
            </motion.div>
          )}
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ProfileTab
                xp={xp}
                streak={streak}
                completedLevels={completedLevels}
                bestRound={bestRound}
                totalSolved={totalSolved}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="relative flex border-t border-[#1a1050] bg-[#0a0428]">
        {navItems.map(({ id, Icon, label }) => (
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

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("main");
  const [activeTab, setActiveTab] = useState<TabId>("home");

  // Progress state
  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [streak] = useState(7);
  const [bestRound, setBestRound] = useState(0);
  const [totalSolved, setTotalSolved] = useState(0);

  // Puzzle state
  const [currentLevel, setCurrentLevel] = useState<Level>(LEVELS[0]);
  const [fills, setFills] = useState<Record<string, number | null>>({});
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [hearts, setHearts] = useState(3);
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Challenge state
  const [isChallenge, setIsChallenge] = useState(false);
  const [challengeRound, setChallengeRound] = useState(1);

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

  function startChallenge() {
    const round = 1;
    setChallengeRound(round);
    setIsChallenge(true);
    startLevel(generatePuzzle(round));
  }

  function handleNextChallengeRound() {
    const next = challengeRound + 1;
    setChallengeRound(next);
    startLevel(generatePuzzle(next));
  }

  function handleEndChallenge() {
    setIsChallenge(false);
    setActiveTab("challenges");
    setScreen("main");
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
      setTotalSolved((prev) => prev + 1);
      setTotalXp((prev) => prev + currentLevel.xpReward);
      if (!isChallenge) {
        setCompletedLevels((prev) => [...new Set([...prev, currentLevel.id])]);
      }
      setTimeout(() => setScreen("result"), 1300);
    } else {
      const newHearts = hearts - 1;
      setHearts(newHearts);
      if (newHearts <= 0) {
        if (isChallenge) {
          setBestRound((prev) => Math.max(prev, challengeRound));
        }
        setTimeout(() => setScreen("result"), 950);
      } else {
        setTimeout(() => {
          setCellStatuses({});
          setHasChecked(false);
        }, 1500);
      }
    }
  }

  const canCheck = Object.keys(currentLevel.answers).every((id) => fills[id] != null);

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {screen === "main" && (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen">
            <MainScreen
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              levels={LEVELS}
              completedLevels={completedLevels}
              xp={totalXp}
              streak={streak}
              bestRound={bestRound}
              totalSolved={totalSolved}
              onStartLevel={startLevel}
              onStartChallenge={startChallenge}
            />
          </motion.div>
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
            isChallenge={isChallenge}
            challengeRound={challengeRound}
            onCellClick={handleCellClick}
            onBankClick={handleBankClick}
            onCheck={checkAnswers}
            onBack={() => {
              setIsChallenge(false);
              setActiveTab(isChallenge ? "challenges" : "home");
              setScreen("main");
            }}
          />
        )}
        {screen === "result" && (
          <ResultScreen
            key="result"
            level={currentLevel}
            isCorrect={isCorrect}
            xpEarned={isCorrect ? currentLevel.xpReward : 0}
            isChallenge={isChallenge}
            challengeRound={challengeRound}
            onContinue={() => { setActiveTab("home"); setScreen("main"); }}
            onRetry={() => startLevel(currentLevel)}
            onNextRound={handleNextChallengeRound}
            onEndChallenge={handleEndChallenge}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
