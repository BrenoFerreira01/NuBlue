import { DailyRunScreen } from "components/challenges/DailyRunScreen";
import { LANDING_DAILY_STORAGE_KEY } from "lib/game/landingDailyProgress";

/** Desafio diário da landing page: começa no degrau 0, com 3 vidas próprias. */
export function LandingDailyChallenge({
  challengeDate,
  dark,
  onThemeChange,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <DailyRunScreen
        source="local"
        date={challengeDate}
        startStep={0}
        storageKey={LANDING_DAILY_STORAGE_KEY}
        dark={dark}
        onThemeChange={onThemeChange}
        onExit={onClose}
        backLabel="Voltar para a landing page"
        exitLabel="Voltar a página inicial"
        successDescription="Seu desafio de hoje terminou. A recompensa fica nesta experiência e não é vinculada a um perfil."
      />
    </div>
  );
}
