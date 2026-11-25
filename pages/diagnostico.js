import { useRouter } from "next/router";
import { DiagnosticTest } from "components/onboarding/DiagnosticTest";
import { useNublue } from "components/providers/NublueProvider";

export default function Diagnostico() {
  const router = useRouter();
  const nublue = useNublue();
  return (
    <DiagnosticTest
      dark={nublue.dark}
      onThemeChange={nublue.setDark}
      onBack={() => router.push("/")}
      onSkip={nublue.skipDiagnostic}
      onFinish={nublue.finishDiagnostic}
    />
  );
}
