import { GAME_PATH, isGamePath, tabForPath, TAB_PATHS } from "lib/routes.js";

describe("rotas do jogo", () => {
  it("cada aba tem uma URL própria e volta para a mesma aba", () => {
    for (const [tab, path] of Object.entries(TAB_PATHS)) {
      expect(tabForPath(path)).toBe(tab);
    }
    expect(new Set(Object.values(TAB_PATHS)).size).toBe(5);
  });

  it("só abas e o puzzle são rotas do jogo", () => {
    expect(isGamePath(GAME_PATH)).toBe(true);
    expect(isGamePath("/ranking")).toBe(true);
    expect(isGamePath("/")).toBe(false);
    expect(isGamePath("/diagnostico")).toBe(false);
    expect(isGamePath("/verificar-email")).toBe(false);
    expect(tabForPath("/")).toBeNull();
  });
});
