import { useEffect, useRef, useState } from "react";
import type { CellStatus, Difficulty, Level } from "../../types/game";
import { createSeededRandom } from "../challenges/dailyChallenge";
import { generatePuzzle } from "../challenges/generatePuzzle";
import { PuzzleScreen } from "../game/components/PuzzleScreen";

const TOTAL_CROSSWORDS = 6;

function createDiagnosticPuzzle(step: number): Level {
  const round = (step + 1) * 2;
  const puzzle = generatePuzzle(round, createSeededRandom(`placement-test-${step + 1}`));

  return {
    ...puzzle,
    id: -(100_000 + step),
    chapter: 0,
    title: `Cruzadinha ${step + 1}`,
    xpReward: 0,
  };
}

interface Props {
  dark: boolean;
  onThemeChange: (dark: boolean) => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: (difficulty: Difficulty) => void;
}

export function DiagnosticTest({ dark, onThemeChange, onBack, onSkip, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(() => createDiagnosticPuzzle(0));
  const [fills, setFills] = useState<Record<string, number | null>>({});
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [hasChecked, setHasChecked] = useState(false);
  const answerTimeout = useRef<number | null>(null);
  const canCheck = Object.keys(level.answers).every((id) => fills[id] != null);
  const filledCount = Object.keys(level.answers).filter((id) => fills[id] != null).length;
  const crosswordProgress = Object.keys(level.answers).length > 0 ? filledCount / Object.keys(level.answers).length : 0;

  useEffect(() => () => {
    if (answerTimeout.current !== null) window.clearTimeout(answerTimeout.current);
  }, []);

  const handleCellClick = (inputId: string) => {
    if (hasChecked) return;
    const nextFill = selectedBank !== null ? selectedBank : null;
    setFills((previous) => ({ ...previous, [inputId]: nextFill }));
    setSelectedBank(null);
  };

  const handleDropNumber = (inputId: string, number: number) => {
    if (hasChecked || !(inputId in level.answers)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
  };

  const handleBankClick = (number: number) => {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  };

  const handleCheck = () => {
    if (hasChecked || !canCheck) return;

    const statuses: Record<string, CellStatus> = {};
    let allCorrect = true;
    for (const [id, answer] of Object.entries(level.answers)) {
      const correct = fills[id] === answer;
      statuses[id] = correct ? "correct" : "wrong";
      if (!correct) allCorrect = false;
    }

    setCellStatuses(statuses);
    setHasChecked(true);
    const nextScore = score + Number(allCorrect);

    answerTimeout.current = window.setTimeout(() => {
      if (step === TOTAL_CROSSWORDS - 1) {
        onFinish(nextScore >= 5 ? "hard" : nextScore >= 3 ? "medium" : "easy");
        return;
      }

      const nextStep = step + 1;
      setScore(nextScore);
      setStep(nextStep);
      setLevel(createDiagnosticPuzzle(nextStep));
      setFills({});
      setSelectedBank(null);
      setCellStatuses({});
      setHasChecked(false);
    }, 900);
  };

  return (
    <PuzzleScreen
      level={level}
      fills={fills}
      selectedBank={selectedBank}
      hearts={0}
      cellStatuses={cellStatuses}
      hasChecked={hasChecked}
      canCheck={canCheck}
      isChallenge={false}
      badgeLabel={`Teste de nivelamento · ${step + 1}/${TOTAL_CROSSWORDS}`}
      progressOverride={(step + crosswordProgress) / TOTAL_CROSSWORDS}
      showHearts={false}
      backLabel="Voltar para a página inicial"
      secondaryAction={{ label: "Pular cruzadinhas e começar do início", onClick: onSkip }}
      dark={dark}
      onThemeChange={onThemeChange}
      onCellClick={handleCellClick}
      onBankClick={handleBankClick}
      onDropNumber={handleDropNumber}
      onCheck={handleCheck}
      onBack={onBack}
    />
  );
}
