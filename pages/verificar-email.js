import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useNublue } from "components/providers/NublueProvider";
import { api } from "lib/api";

/** Destino do link de confirmação enviado por e-mail. */
export default function VerificarEmail() {
  const router = useRouter();
  const { setSessionNotice } = useNublue();
  const started = useRef(false);

  useEffect(() => {
    if (!router.isReady || started.current) return;
    started.current = true;
    const token = String(router.query.token ?? "");
    api
      .verifyEmail(token)
      .then(() =>
        setSessionNotice("E-mail confirmado! Entre com seu apelido e senha."),
      )
      .catch((error) => setSessionNotice(error.message))
      .finally(() => router.replace("/"));
  }, [router, setSessionNotice]);

  return (
    <p className="p-8 text-center font-bold text-muted-foreground">
      Confirmando seu e-mail…
    </p>
  );
}
