// URL de cada aba do jogo. O estado do jogo (useGameController) continua sendo
// a fonte da verdade; a URL acompanha (ver NublueProvider).

export const TAB_PATHS = {
  home: "/aprender",
  challenges: "/desafios",
  ranking: "/ranking",
  profile: "/perfil",
  settings: "/configuracoes",
};

export const GAME_PATH = "/jogar";

export function tabForPath(pathname) {
  return (
    Object.entries(TAB_PATHS).find(([, path]) => path === pathname)?.[0] ?? null
  );
}

/** Rotas do jogo em si (abas e puzzle), onde a URL segue o estado. */
export function isGamePath(pathname) {
  return pathname === GAME_PATH || tabForPath(pathname) !== null;
}
