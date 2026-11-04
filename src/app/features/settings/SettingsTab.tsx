import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronRight, LogOut, Shield } from "lucide-react";
import type { Difficulty } from "../../types/game";

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onReturnToLanding: () => void;
}

const DIFFICULTY_OPTIONS: [Difficulty, string, string][] = [
  ["easy", "Iniciante", "Números menores e mais dicas"],
  ["medium", "Intermediário", "Desafios equilibrados"],
  ["hard", "Avançado", "Operações complexas"],
];

export function SettingsTab({ difficulty, onDifficultyChange, onReturnToLanding }: Props) {
  const [reminders, setReminders] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("nublue-daily-reminders") !== "off";
  });
  const updateReminders = (enabled: boolean) => {
    setReminders(enabled);
    window.localStorage.setItem("nublue-daily-reminders", enabled ? "on" : "off");
  };

  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain px-3 py-6 sm:px-6">
      <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Personalização</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Configurações</h1>

      <div className="mt-8 space-y-5">
        <section className="rounded-[26px] border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Shield className="text-accent" />
            <div>
              <h2 className="font-black text-foreground">Dificuldade geral</h2>
              <p className="text-sm font-semibold text-muted-foreground">
                Escolha o nível de desafio para sua trilha de aprendizagem.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {DIFFICULTY_OPTIONS.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                aria-pressed={difficulty === value}
                onClick={() => onDifficultyChange(value)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  difficulty === value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:border-primary/50"
                }`}
              >
                <p className="font-black text-foreground">{label}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-border bg-card">
          <SettingRow
            Icon={Bell}
            title="Lembretes diários"
            description="Sua preferência fica salva neste dispositivo."
            action={<Toggle on={reminders} setOn={updateReminders} />}
          />
        </section>

        <button
          type="button"
          onClick={onReturnToLanding}
          className="flex w-full items-center justify-between rounded-[24px] border border-red-500/20 bg-red-500/5 p-5 font-black text-red-500"
        >
          <span className="flex items-center gap-3">
            <LogOut size={20} />
            Sair da conta
          </span>
          <ChevronRight size={19} />
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  Icon,
  title,
  description,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border p-5 last:border-0">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-foreground">{title}</p>
        <p className="truncate text-sm font-semibold text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Toggle({ on, setOn }: { on: boolean; setOn: (on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      aria-label="Lembretes diários"
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white transition ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}
