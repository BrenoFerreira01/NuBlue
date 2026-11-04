import type { FormEvent } from "react";
import { Brand } from "../../../components/Brand";
import { DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";

export type AuthMode = "login" | "signup";

interface Props {
  mode: AuthMode;
  onSubmit: (name?: string) => void;
  onSwitchMode: () => void;
}

export function AuthDialog({ mode, onSubmit, onSwitchMode }: Props) {
  const isSignup = mode === "signup";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name");
    onSubmit(typeof name === "string" ? name.trim() : undefined);
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
        {isSignup && (
          <input
            required
            aria-label="Nome"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={48}
            pattern=".*\S.*"
            placeholder="Seu nome"
            className="w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary"
          />
        )}
        <input
          required
          aria-label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          className="w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary"
        />
        <input
          required
          aria-label="Senha"
          name="password"
          type="password"
          minLength={4}
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="Sua senha"
          className="w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground shadow-[0_6px_0_var(--button-shadow)] transition active:translate-y-1 active:shadow-none"
        >
          {isSignup ? "Criar conta e fazer teste" : "Entrar na Nublue"}
        </button>
      </form>

      <button
        type="button"
        onClick={onSwitchMode}
        className="mt-5 w-full text-sm font-extrabold text-muted-foreground transition hover:text-foreground"
      >
        {isSignup ? "Já tem conta? Faça login" : "Novo por aqui? Crie sua conta"}
      </button>
    </div>
  );
}
