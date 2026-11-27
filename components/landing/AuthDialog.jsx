import { useState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { ApiClientError } from "lib/api";
import { Brand } from "components/Brand";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "components/ui/dialog";
const inputClassName =
  "w-full rounded-2xl border border-border bg-secondary px-4 py-4 font-bold text-foreground outline-none transition placeholder:text-[var(--input-placeholder-color)] focus:ring-2 focus:ring-primary";
const errorMessage = (error) =>
  error instanceof Error ? error.message : "Não foi possível entrar agora.";
export function AuthDialog({
  mode,
  onSubmit,
  onResendVerification,
  onSwitchMode,
}) {
  const isSignup = mode === "signup";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Set after a signup, or a login refused because the e-mail is not confirmed yet.
  const [pendingVerification, setPendingVerification] = useState(null);
  const [signupEmail, setSignupEmail] = useState(null);
  // Corrected address typed after "E-mail errado?"; null while the option is closed.
  const [correctedEmail, setCorrectedEmail] = useState(null);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = formData.get("nickname");
    const email = formData.get("email") ?? "";
    const password = formData.get("password");
    if (
      typeof nickname !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    )
      return;
    const credentials = {
      nickname: nickname.trim(),
      email: email.trim(),
      password,
    };
    setError(null);
    setNotice(null);
    setPendingVerification(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit(credentials);
      if (isSignup && result?.verificationRequired !== false) {
        setSignupEmail(credentials.email);
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
      if (
        submitError instanceof ApiClientError &&
        submitError.code === "email_not_verified"
      ) {
        setPendingVerification(credentials);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const resend = async () => {
    if (!pendingVerification) return;
    const email = correctedEmail?.trim() || undefined;
    setError(null);
    setIsSubmitting(true);
    try {
      await onResendVerification(
        pendingVerification.nickname,
        pendingVerification.password,
        email,
      );
      setCorrectedEmail(null);
      setNotice(
        email
          ? `Enviamos um novo link para ${email}. Confira a caixa de entrada e o spam.`
          : "Enviamos um novo link. Confira sua caixa de entrada e o spam.",
      );
    } catch (resendError) {
      setError(errorMessage(resendError));
    } finally {
      setIsSubmitting(false);
    }
  };
  if (signupEmail) {
    return (
      <div>
        <Brand />
        <div className="mt-9 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <MailCheck aria-hidden className="size-7" />
        </div>
        <DialogHeader className="mt-5 gap-2">
          <DialogTitle className="text-3xl font-black tracking-[-0.04em]">
            Confirme seu e-mail
          </DialogTitle>
          <DialogDescription className="text-base font-semibold">
            Enviamos um link para{" "}
            <strong className="break-all text-foreground">{signupEmail}</strong>
            . Abra o link para ativar sua conta e depois entre com seu apelido e
            senha.
          </DialogDescription>
        </DialogHeader>
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          Não chegou? Confira o spam. Ao tentar entrar, você pode pedir um novo
          link ou corrigir o e-mail.
        </p>
        <button
          type="button"
          onClick={() => {
            setSignupEmail(null);
            onSwitchMode();
          }}
          className="mt-7 w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground shadow-[0_6px_0_var(--button-shadow)] transition active:translate-y-1 active:shadow-none"
        >
          Ir para o login
        </button>
      </div>
    );
  }
  return (
    <div>
      <Brand />
      <DialogHeader className="mt-9 gap-2">
        <DialogTitle className="text-3xl font-black tracking-[-0.04em]">
          {isSignup ? "Crie seu perfil" : "Que bom ter você aqui"}
        </DialogTitle>
        <DialogDescription className="text-base font-semibold">
          {isSignup
            ? "Depois de confirmar seu e-mail, faremos um teste rápido para personalizar sua trilha."
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
          className={inputClassName}
        />
        {isSignup && (
          <input
            required
            aria-label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="Seu e-mail ou de um responsável"
            className={inputClassName}
          />
        )}
        <PasswordInput
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
        {error && (
          <p className="text-sm font-bold text-destructive" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm font-bold text-primary" role="status">
            {notice}
          </p>
        )}
        {pendingVerification && (
          <div className="space-y-3">
            {correctedEmail !== null && (
              <input
                aria-label="E-mail correto"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={correctedEmail}
                onChange={(event) => setCorrectedEmail(event.target.value)}
                placeholder="E-mail correto"
                className={inputClassName}
              />
            )}
            <button
              type="button"
              disabled={isSubmitting || correctedEmail?.trim() === ""}
              onClick={resend}
              className="w-full rounded-2xl border border-border bg-secondary py-3 text-sm font-extrabold text-foreground transition hover:bg-secondary/70 disabled:opacity-60"
            >
              {correctedEmail === null
                ? "Reenviar e-mail de confirmação"
                : "Enviar para este e-mail"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                setCorrectedEmail(correctedEmail === null ? "" : null)
              }
              className="w-full text-sm font-extrabold text-muted-foreground transition hover:text-foreground"
            >
              {correctedEmail === null
                ? "E-mail errado? Corrigir"
                : "Cancelar correção"}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-primary py-4 font-black text-primary-foreground shadow-[0_6px_0_var(--button-shadow)] transition active:translate-y-1 active:shadow-none"
        >
          {isSubmitting
            ? "Aguarde..."
            : isSignup
              ? "Criar conta"
              : "Entrar na Nublue"}
        </button>
      </form>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={onSwitchMode}
        className="mt-5 w-full text-sm font-extrabold text-muted-foreground transition hover:text-foreground"
      >
        {isSignup
          ? "Já tem conta? Faça login"
          : "Novo por aqui? Crie sua conta"}
      </button>
    </div>
  );
}

/** Campo de senha com botão para mostrar ou ocultar o que foi digitado. */
function PasswordInput({ autoComplete }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input
        required
        aria-label="Senha"
        name="password"
        type={visible ? "text" : "password"}
        minLength={8}
        maxLength={128}
        autoComplete={autoComplete}
        placeholder="Sua senha"
        className={`${inputClassName} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-2 my-auto flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-[var(--hover-surface)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
