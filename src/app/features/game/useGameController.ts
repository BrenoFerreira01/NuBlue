import { useState } from "react";
import type { CellStatus, Level, Screen, TabId } from "../../types/game";
import { LEVELS } from "../../data/levels";
import { generatePuzzle } from "../challenges/generatePuzzle";

export function useGameController() {
  const [screen, setScreen] = useState<Screen>("main");
  const [activeTab, setActiveTab] = useState<TabId>("home");

  const [completedLevels, setCompletedLevels] = useState<number[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [streak] = useState(7);
  const [bestRound, setBestRound] = useState(0);
  const [totalSolved, setTotalSolved] = useState(0);

  const [currentLevel, setCurrentLevel] = useState<Level>(LEVELS[0]);
  const [fills, setFills] = useState<Record<string, number | null>>({});
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [hearts, setHearts] = useState(3);
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

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
      setFills((previous) => ({ ...previous, [inputId]: selectedBank }));
      setSelectedBank(null);
    } else {
      setFills((previous) => ({ ...previous, [inputId]: null }));
    }
  }

  function handleDropNumber(inputId: string, number: number) {
    if (hasChecked || !(inputId in currentLevel.answers)) return;
    setFills((previous) => ({ ...previous, [inputId]: number }));
    setSelectedBank(null);
  }

  function handleBankClick(number: number) {
    if (hasChecked) return;
    setSelectedBank((previous) => (previous === number ? null : number));
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
      setTotalSolved((previous) => previous + 1);
      setTotalXp((previous) => previous + currentLevel.xpReward);
      if (!isChallenge) {
        setCompletedLevels((previous) => [...new Set([...previous, currentLevel.id])]);
      }
      setTimeout(() => setScreen("result"), 1300);
      return;
    }

    const remainingHearts = hearts - 1;
    setHearts(remainingHearts);
    if (remainingHearts <= 0) {
      if (isChallenge) {
        setBestRound((previous) => Math.max(previous, challengeRound));
      }
      setTimeout(() => setScreen("result"), 950);
    } else {
      setTimeout(() => {
        setCellStatuses({});
        setHasChecked(false);
      }, 1500);
    }
  }

  function handlePuzzleBack() {
    const wasChallenge = isChallenge;
    setIsChallenge(false);
    setActiveTab(wasChallenge ? "challenges" : "home");
    setScreen("main");
  }

  function handleResultContinue() {
    setActiveTab("home");
    setScreen("main");
  }

  const canCheck = Object.keys(currentLevel.answers).every((id) => fills[id] != null);

  return {
    screen,
    activeTab,
    setActiveTab,
    completedLevels,
    totalXp,
    streak,
    bestRound,
    totalSolved,
    currentLevel,
    fills,
    selectedBank,
    hearts,
    cellStatuses,
    isCorrect,
    hasChecked,
    isChallenge,
    challengeRound,
    canCheck,
    startLevel,
    startChallenge,
    handleNextChallengeRound,
    handleEndChallenge,
    handleCellClick,
    handleDropNumber,
    handleBankClick,
    checkAnswers,
    handlePuzzleBack,
    handleResultContinue,
  };
}
