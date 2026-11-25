import dynamic from "next/dynamic";
import Head from "next/head";
import { Nunito } from "next/font/google";
import "styles/globals.css";

// Fonte hospedada pelo próprio site (sem requisição ao Google no navegador).
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

// O app depende do localStorage (tema, progresso de visitante), então roda só
// no navegador, como o SPA anterior.
const NublueProvider = dynamic(
  () => import("components/providers/NublueProvider"),
  { ssr: false },
);

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Nublue — Aprenda matemática jogando</title>
        <meta
          name="description"
          content="Aprenda matemática resolvendo cruzadinhas numéricas, avance no seu ritmo e acompanhe seu progresso na Nublue."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style jsx global>{`
        :root {
          --font-nunito: ${nunito.style.fontFamily};
        }
      `}</style>
      <NublueProvider>
        <Component {...pageProps} />
      </NublueProvider>
    </>
  );
}
