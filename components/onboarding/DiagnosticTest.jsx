import { useEffect, useRef, useState } from "react";
import { createSeededRandom } from "lib/game/dailyChallenge";
import { generatePuzzle } from "lib/game/generatePuzzle";
import { PuzzleScreen } from "components/game/PuzzleScreen";
const TOTAL_CROSSWORDS = 6;
function createDiagnosticPuzzle(step) {
  const round = (step + 1) * 2;
  const puzzle = generatePuzzle(
    round,
    createSeededRandom(`placement-test-${step + 1}`),
  );
  return {
    ...puzzle,
    id: -(100_000 + step),
    chapter: 0,
    title: `Cruzadinha ${step + 1}`,
    xpReward: 0,
  };
}
export function DiagnosticTest({
  dark,
  onThemeChange,
  onBack,
  onSkip,
  onFinish,
}) {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(() => createDiagnosticPuzzle(0));
  const [fills, setFills] = useState({});
  const [selectedBank, setSelectedBank] = useState(null);
  const [cellStatuses, setCellStatuses] = useState({});
  const [hasChecked, setHasChecked] = useState(false);
  const answerTimeout = useRef(null);
  const answerKey = level.answers ?? {};
  const canCheck = Object.keys(answerKey).every((id) => fills[id] != null);
  const filledCount = Object.keys(answerKey).filter(
    (id) => fills[id] != null,
  ).length;
  const crosswordProgress =
    Object.keys(answerKey).length > 0
      ? filledCount / Object.keys(answerKey).length
      : 0;
  useEffect(
    () => () => {
      if (answerTimeout.current !== null)
        window.clearTimeout(answerTimeout.current);
    },
    [],
  );
  const handleCellClick = (inputId) => {
    if (hasChecked) return;
    const nextFill = selectedBank !== null ? selectedBank : null;
    setFills((previous) => ({ ...previous, [inputId]: nextFill }));
    setSelectedBank(null);
  };
  const handleDropNumber = (inputId, number) => {
    if (hasChecked || !(inputId in answerKey)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
  };
  const handleBankClick = (number) => {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  };
  const handleCheck = () => {
    if (hasChecked || !canCheck) return;
    const statuses = {};
    let allCorrect = true;
    for (const [id, answer] of Object.entries(answerKey)) {
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
      secondaryAction={{
        label: "Pular cruzadinhas e começar do início",
        onClick: onSkip,
      }}
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
