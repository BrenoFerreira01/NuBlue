import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api } from "lib/api";
import { LEVELS } from "lib/game/levels";
import { useGameController } from "lib/game/useGameController";
import { onSessionExpired } from "lib/sessionEvents";
import { GAME_PATH, isGamePath, TAB_PATHS } from "lib/routes";

const NublueContext = createContext(null);

export function useNublue() {
  const context = useContext(NublueContext);
  if (!context) throw new Error("useNublue precisa do NublueProvider.");
  return context;
}

function readChapter() {
  const saved = Number(window.localStorage.getItem("nublue-chapter"));
  return Number.isInteger(saved) && saved >= 1 && saved <= 5 ? saved : 1;
}

/**
 * Estado do aplicativo que antes ficava no App.jsx do Vite: aluno logado, tema,
 * catálogo e o controlador do jogo. Renderizado só no navegador (ver _app.js),
 * porque depende do localStorage.
 */
export default function NublueProvider({ children }) {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const studentRef = useRef(null);
  studentRef.current = student;
  const [ready, setReady] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(null);
  const [courseCatalog, setCourseCatalog] = useState(null);
  const [bonusLevel, setBonusLevel] = useState(null);
  const [dark, setDark] = useState(
    () => window.localStorage.getItem("nublue-theme") === "dark",
  );
  const [userName, setUserName] = useState("Jogador");
  const [chapterId, setChapterId] = useState(readChapter);
  const levels = courseCatalog?.levels ?? LEVELS;
  const game = useGameController({
    levels,
    authenticated: Boolean(student),
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("nublue-theme", dark ? "dark" : "light");
  }, [dark]);

  // Aluno com sessão válida vai direto para o jogo.
  useEffect(() => {
    let active = true;
    api
      .catalog()
      .then((catalog) => active && setCourseCatalog(catalog))
      .catch(() => undefined);
    api
      .me()
      .then(({ student: current }) => {
        if (!active) return;
        setStudent(current);
        setUserName(current.nickname);
        if (router.pathname === "/") router.replace(TAB_PATHS.home);
      })
      .catch(() => undefined)
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
    // Só na abertura do site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A URL acompanha o estado do jogo: puzzle/resultado em /jogar, abas nas suas URLs.
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    if (game.screen !== "main") {
      if (router.pathname !== GAME_PATH) router.push(GAME_PATH);
      return;
    }
    const target = TAB_PATHS[game.activeTab];
    if (isGamePath(router.pathname) && router.pathname !== target) {
      // Sair do puzzle substitui /jogar no histórico; trocar de aba empilha.
      if (router.pathname === GAME_PATH) router.replace(target);
      else router.push(target);
    }
    // router muda a cada navegação; reagimos só ao estado do jogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.screen, game.activeTab]);

  // Quem está logado e volta para "/" pelo navegador vai para o jogo, não para
  // o formulário de login. (No logout, studentRef já é null antes de navegar.)
  useEffect(() => {
    const onRouteChange = (url) => {
      if (url.split("?")[0] === "/" && studentRef.current) {
        router.replace(TAB_PATHS.home);
      }
    };
    router.events.on("routeChangeComplete", onRouteChange);
    return () => router.events.off("routeChangeComplete", onRouteChange);
  }, [router]);

  const resetSessionRef = useRef(game.resetSession);
  resetSessionRef.current = game.resetSession;
  const leaveAccount = () => {
    // Zerado na hora: 401 de requisições ainda em andamento não viram "sessão expirada".
    studentRef.current = null;
    setStudent(null);
    setBonusLevel(null);
    // Reseta o jogo só depois de sair das rotas do jogo; antes disso, a
    // sincronia de URL levaria de volta para /aprender.
    router.push("/").then(() => resetSessionRef.current());
  };

  useEffect(
    () =>
      onSessionExpired(() => {
        if (!studentRef.current) return;
        leaveAccount();
        setSessionNotice("Sua sessão expirou. Entre novamente para continuar.");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!student || !game.levelAvailability?.bonusAvailable || bonusLevel)
      return;
    let active = true;
    api
      .bonusLevel()
      .then(({ level }) => active && setBonusLevel(level))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [student, game.levelAvailability?.bonusAvailable, bonusLevel]);

  const enterGame = () => {
    game.setActiveTab("home");
    router.push(TAB_PATHS.home);
  };

  const startDiagnostic = (name) => {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (normalizedName) setUserName(normalizedName);
    router.push("/diagnostico");
  };

  const login = async (nickname, password) => {
    const { student: signedIn } = await api.login(nickname, password);
    setSessionNotice(null);
    const [catalog, progress] = await Promise.all([
      api.catalog(),
      api.progress(),
    ]);
    setCourseCatalog(catalog);
    setStudent(signedIn);
    setUserName(signedIn.nickname);
    // Contas novas só têm sessão depois de confirmar o e-mail, então o teste
    // inicial roda no primeiro login de quem ainda não jogou.
    if (progress.totalSolved === 0 && progress.completedLevels.length === 0) {
      startDiagnostic(signedIn.nickname);
    } else {
      enterGame();
    }
  };

  // Só cria a conta: o aluno entra depois de confirmar o e-mail.
  const signup = async ({ nickname, email, password }) => {
    await api.register(nickname, email, password);
    setSessionNotice(null);
  };

  const resendVerification = (nickname, password, email) =>
    api.resendVerification(nickname, password, email);

  const changeChapter = (nextChapter) => {
    setChapterId(nextChapter);
    window.localStorage.setItem("nublue-chapter", String(nextChapter));
  };

  const finishDiagnostic = (difficulty) => {
    game.setDifficulty(difficulty);
    enterGame();
  };

  const skipDiagnostic = () => {
    changeChapter(1);
    finishDiagnostic("easy");
  };

  const returnToLanding = async () => {
    try {
      if (student) await api.logout();
    } catch {
      // Sai localmente mesmo sem conseguir falar com o servidor.
    } finally {
      leaveAccount();
    }
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    leaveAccount();
  };

  const setLeaderboardOptIn = async (enabled) => {
    const result = await api.setLeaderboardVisibility(enabled);
    setStudent((current) => (current ? { ...current, ...result } : current));
  };

  const value = {
    student,
    ready,
    dark,
    setDark,
    game,
    levels,
    bonusLevel,
    userName,
    chapterId,
    changeChapter,
    login,
    signup,
    resendVerification,
    startDiagnostic,
    finishDiagnostic,
    skipDiagnostic,
    returnToLanding,
    deleteAccount,
    setLeaderboardOptIn,
    sessionNotice,
    setSessionNotice,
  };

  return (
    <NublueContext.Provider value={value}>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        {sessionNotice && (
          <div
            role="status"
            className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-card px-4 py-3 text-sm font-bold text-foreground shadow-lg"
          >
            <span>{sessionNotice}</span>
            <button
              type="button"
              onClick={() => setSessionNotice(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-muted-foreground hover:bg-secondary"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </NublueContext.Provider>
  );
}
