import { useState } from "react";
import { isSoundEnabled, playSound, setSoundEnabled } from "lib/game/sound";
import {
  Bell,
  ChevronRight,
  LogOut,
  Shield,
  Trash2,
  Trophy,
  Volume2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "components/ui/alert-dialog";
const DIFFICULTY_OPTIONS = [
  [
    "easy",
    "Iniciante",
    "Grades pequenas, resolvidas em cadeia, números até 20",
  ],
  ["medium", "Intermediário", "Mais contas cruzadas, números até 50"],
  ["hard", "Avançado", "Grades maiores, mais lacunas, números até 120"],
];
export function SettingsTab({
  difficulty,
  onDifficultyChange,
  onReturnToLanding,
  onDeleteAccount,
  leaderboardOptIn,
  onLeaderboardOptInChange,
}) {
  const [visibilityError, setVisibilityError] = useState(null);
  const [sound, setSound] = useState(isSoundEnabled);
  const updateSound = (enabled) => {
    setSoundEnabled(enabled);
    setSound(enabled);
    if (enabled) playSound("correct");
  };
  const [reminders, setReminders] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("nublue-daily-reminders") !== "off";
  });
  const updateReminders = (enabled) => {
    setReminders(enabled);
    window.localStorage.setItem(
      "nublue-daily-reminders",
      enabled ? "on" : "off",
    );
  };
  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain px-3 py-6 sm:px-6">
      <p className="text-xs font-black uppercase tracking-[.18em] text-primary">
        Personalização
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
        Configurações
      </h1>

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
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-border bg-card">
          <SettingRow
            Icon={Volume2}
            title="Efeitos sonoros"
            description="Sons de acerto, erro, conquistas e vidas."
            action={
              <Toggle label="Efeitos sonoros" on={sound} setOn={updateSound} />
            }
          />
          <SettingRow
            Icon={Bell}
            title="Lembretes diários"
            description="Sua preferência fica salva neste dispositivo."
            action={
              <Toggle
                label="Lembretes diários"
                on={reminders}
                setOn={updateReminders}
              />
            }
          />
        </section>

        <section className="overflow-hidden rounded-[26px] border border-border bg-card">
          <SettingRow
            Icon={Trophy}
            title="Aparecer no ranking"
            description="Seu apelido ficará visível para outros estudantes."
            action={
              <Toggle
                label="Aparecer no ranking"
                on={leaderboardOptIn}
                setOn={async (enabled) => {
                  setVisibilityError(null);
                  try {
                    await onLeaderboardOptInChange(enabled);
                  } catch {
                    setVisibilityError(
                      "Não foi possível salvar essa preferência.",
                    );
                  }
                }}
              />
            }
          />
          {visibilityError && (
            <p
              className="px-5 pb-4 text-sm font-bold text-destructive"
              role="alert"
            >
              {visibilityError}
            </p>
          )}
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

        {onDeleteAccount && (
          <DeleteAccountButton onDeleteAccount={onDeleteAccount} />
        )}
      </div>
    </div>
  );
}
function DeleteAccountButton({ onDeleteAccount }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (deleting) return;
        setOpen(nextOpen);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[24px] border border-border bg-card p-5 font-black text-muted-foreground hover:text-red-500"
        >
          <span className="flex items-center gap-3">
            <Trash2 size={20} />
            Excluir conta
          </span>
          <ChevronRight size={19} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
          <AlertDialogDescription>
            Seu apelido, progresso, XP, sequências e posição no ranking serão
            apagados para sempre. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm font-bold text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async (event) => {
              // Keep the dialog open until the server confirms, so errors stay visible.
              event.preventDefault();
              setDeleting(true);
              setError(null);
              try {
                await onDeleteAccount();
              } catch (deleteError) {
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : "Não foi possível excluir a conta.",
                );
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Excluindo…" : "Excluir para sempre"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function SettingRow({ Icon, title, description, action }) {
  return (
    <div className="flex items-center gap-4 border-b border-border p-5 last:border-0">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-foreground">{title}</p>
        <p className="truncate text-sm font-semibold text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
function Toggle({ label, on, setOn }) {
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      aria-label={label}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white transition ${on ? "left-6" : "left-1"}`}
      />
    </button>
  );
}
