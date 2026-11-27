import { useRef, useState } from "react";
import { generateTrackPuzzle } from "lib/game/trackPuzzle.mjs";
import {
  createPlacement,
  nextPuzzle,
  placementResult,
  recordAnswer,
} from "lib/game/placement";
import { PuzzleScreen } from "components/game/PuzzleScreen";

// O teste tem no máximo 4 cruzadinhas de operações e 2 de dificuldade.
const MAX_CROSSWORDS = 6;

function createDiagnosticLevel(placement, step) {
  const target = nextPuzzle(placement);
  const puzzle = generateTrackPuzzle(target);
  return {
    ...puzzle,
    id: -(100_000 + step),
    chapter: 0,
    session: 1,
    title: `Cruzadinha ${step + 1}`,
    subtitle: "Teste de nivelamento",
    difficulty: target.track,
    emoji: "🧭",
    xpReward: 0,
  };
}

/**
 * Teste de nivelamento adaptativo: analisa acertos e tempo e indica o capítulo
 * e a dificuldade geral de partida. Errar mostra a resposta certa e só avança
 * com Continuar.
 */
export function DiagnosticTest({
  dark,
  onThemeChange,
  onBack,
  onSkip,
  onFinish,
}) {
  const [placement, setPlacement] = useState(createPlacement);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState(() =>
    createDiagnosticLevel(createPlacement(), 0),
  );
  const [fills, setFills] = useState({});
  const [selectedBank, setSelectedBank] = useState(null);
  const [cellStatuses, setCellStatuses] = useState({});
  const [checked, setChecked] = useState(null);
  const [correctAnswers, setCorrectAnswers] = useState(null);
  const startedAt = useRef(Date.now());
  const answerKey = level.answers ?? {};
  const inputIds = Object.keys(answerKey);
  const canCheck = !checked && inputIds.every((id) => fills[id] != null);
  const filledCount = inputIds.filter((id) => fills[id] != null).length;
  const crosswordProgress =
    inputIds.length > 0 ? filledCount / inputIds.length : 0;

  const handleCellClick = (inputId) => {
    if (checked) return;
    setFills((previous) => ({ ...previous, [inputId]: selectedBank }));
    setSelectedBank(null);
  };
  const handleDropNumber = (inputId, number) => {
    if (checked || !(inputId in answerKey)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
  };
  const handleBankClick = (number) => {
    if (checked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
  };
  const handleCheck = () => {
    if (!canCheck) return;
    const statuses = Object.fromEntries(
      inputIds.map((id) => [
        id,
        fills[id] === answerKey[id] ? "correct" : "wrong",
      ]),
    );
    const correct = Object.values(statuses).every((s) => s === "correct");
    const seconds = (Date.now() - startedAt.current) / 1000;
    setCellStatuses(statuses);
    setCorrectAnswers(correct ? null : answerKey);
    setChecked(correct ? "correct" : "wrong");
    setPlacement((current) => recordAnswer(current, { correct, seconds }));
  };
  const handleContinue = () => {
    if (!nextPuzzle(placement)) {
      onFinish(placementResult(placement));
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    setLevel(createDiagnosticLevel(placement, nextStep));
    setFills({});
    setSelectedBank(null);
    setCellStatuses({});
    setCorrectAnswers(null);
    setChecked(null);
    startedAt.current = Date.now();
  };
  return (
    <PuzzleScreen
      level={level}
      fills={fills}
      selectedBank={selectedBank}
      hearts={0}
      cellStatuses={cellStatuses}
      hasChecked={Boolean(checked)}
      canCheck={canCheck}
      isChallenge={false}
      badgeLabel={`Teste de nivelamento · ${step + 1}`}
      progressOverride={Math.min(
        1,
        (step + (checked ? 1 : crosswordProgress)) / MAX_CROSSWORDS,
      )}
      showHearts={false}
      checkState={checked ?? "idle"}
      correctAnswers={correctAnswers}
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
      onContinue={handleContinue}
      onBack={onBack}
    />
  );
}
