import { useState, type FormEvent } from "react";
import { Brand } from "../../../components/Brand";
import { DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";

export type AuthMode = "login" | "signup";

interface Props {
  mode: AuthMode;
  onSubmit: (nickname: string, password: string) => Promise<void>;
  onSwitchMode: () => void;
}

export function AuthDialog({ mode, onSubmit, onSwitchMode }: Props) {
  const isSignup = mode === "signup";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = formData.get("nickname");
    const password = formData.get("password");
    if (typeof nickname !== "string" || typeof password !== "string") return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(nickname.trim(), password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível entrar agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Brand />
      <DialogHeader className="mt-9 gap-2">
        <DialogTitle className="text-3xl font-black tracking-[-0.04em]">
          {isSignup ? "Crie seu perfil" : "Que bom ter você aqui"}
        </DialogTitle>
        <DialogDescription className="text-base font-semibold">
          {isSignup
            ? "Depois, faremos um teste rápido para personalizar sua trilha."
            : "Continue sua sequência de onde parou."}
        </DialogDescription>
      </DialogHeader>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        <input
          required
          aria-label="Apelido"
          name="nickname"
          type="text"
          autoComplete="nickname"
          minLength={3}
          maxLength={24}
          placeholder="Seu apelido"
          className="w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary"
        />
        <input
          required
          aria-label="Senha"
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="Sua senha"
          className="w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary"
        />
        {error && <p className="text-sm font-bold text-destructive" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground shadow-[0_6px_0_var(--button-shadow)] transition active:translate-y-1 active:shadow-none"
        >
          {isSubmitting ? "Aguarde..." : isSignup ? "Criar conta e fazer teste" : "Entrar na Nublue"}
        </button>
      </form>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={onSwitchMode}
        className="mt-5 w-full text-sm font-extrabold text-muted-foreground transition hover:text-foreground"
      >
        {isSignup ? "Já tem conta? Faça login" : "Novo por aqui? Crie sua conta"}
      </button>
    </div>
  );
}
