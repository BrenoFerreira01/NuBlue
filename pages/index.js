import { LandingPage } from "components/landing/LandingPage";
import { useNublue } from "components/providers/NublueProvider";

export default function Home() {
  const nublue = useNublue();
  return (
    <LandingPage
      dark={nublue.dark}
      onThemeChange={nublue.setDark}
      onLogin={nublue.login}
      onSignup={nublue.signup}
      onResendVerification={nublue.resendVerification}
      dailyChallengeDate={nublue.game.today}
    />
  );
}
