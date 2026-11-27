import {
  LIFE_REGEN_MS,
  MAX_LIVES,
  fullLives,
  livesAt,
  spendLife,
} from "lib/game/lives.mjs";

const T0 = Date.UTC(2026, 10, 27, 12, 0, 0);
const min = (n) => n * 60 * 1000;

describe("vidas das lições", () => {
  it("começa com 5 vidas e nenhum cronômetro", () => {
    expect(MAX_LIVES).toBe(5);
    expect(LIFE_REGEN_MS).toBe(min(15));
    expect(livesAt(fullLives(T0), T0)).toEqual({
      lives: 5,
      updatedAt: T0,
      nextLifeAt: null,
    });
  });

  it("errar gasta uma vida e liga o cronômetro de 15 minutos", () => {
    const after = spendLife(fullLives(T0), T0);
    expect(livesAt(after, T0)).toEqual({
      lives: 4,
      updatedAt: T0,
      nextLifeAt: T0 + min(15),
    });
  });

  it("cada vida volta 15 minutos depois, uma por vez", () => {
    let state = fullLives(T0);
    for (let i = 0; i < 3; i += 1) state = spendLife(state, T0);
    expect(livesAt(state, T0 + min(14)).lives).toBe(2);
    expect(livesAt(state, T0 + min(15)).lives).toBe(3);
    expect(livesAt(state, T0 + min(31))).toMatchObject({
      lives: 4,
      nextLifeAt: T0 + min(45),
    });
    expect(livesAt(state, T0 + min(50))).toMatchObject({
      lives: 5,
      nextLifeAt: null,
    });
  });

  it("perder outra vida no meio da espera não reinicia o cronômetro", () => {
    let state = spendLife(fullLives(T0), T0);
    state = spendLife(state, T0 + min(10));
    expect(livesAt(state, T0 + min(10))).toMatchObject({
      lives: 3,
      nextLifeAt: T0 + min(15),
    });
  });

  it("sem vidas não dá para gastar mais", () => {
    let state = fullLives(T0);
    for (let i = 0; i < 5; i += 1) state = spendLife(state, T0);
    expect(livesAt(state, T0).lives).toBe(0);
    expect(spendLife(state, T0)).toBeNull();
  });

  it("depois de cheias, a próxima perda começa a contar do zero", () => {
    let state = spendLife(fullLives(T0), T0);
    state = spendLife(state, T0 + min(60));
    expect(livesAt(state, T0 + min(60))).toMatchObject({
      lives: 4,
      nextLifeAt: T0 + min(75),
    });
  });
});
