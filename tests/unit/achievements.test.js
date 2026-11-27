import {
  ACHIEVEMENTS,
  newlyUnlocked,
  unlockedIds,
} from "lib/game/achievements.js";

const base = {
  completedLevels: [],
  totalLevels: 39,
  xp: 0,
  streak: 0,
  dailyChallengesCompleted: 0,
  bestDailyStreak: 0,
};

describe("conquistas", () => {
  it("tem as seis conquistas do perfil", () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      "first-step",
      "trail-master",
      "challenger",
      "on-fire",
      "xp-collector",
      "unstoppable",
    ]);
  });

  it("começa sem nada desbloqueado", () => {
    expect(unlockedIds(base)).toEqual([]);
  });

  it("desbloqueia pelas condições do progresso", () => {
    expect(
      unlockedIds({
        ...base,
        completedLevels: [1],
        xp: 120,
        dailyChallengesCompleted: 1,
      }),
    ).toEqual(["first-step", "challenger", "xp-collector"]);
    expect(unlockedIds({ ...base, streak: 7, bestDailyStreak: 7 })).toEqual([
      "on-fire",
      "unstoppable",
    ]);
    expect(
      unlockedIds({
        ...base,
        completedLevels: Array.from({ length: 39 }, (_, i) => i + 1),
      }),
    ).toContain("trail-master");
  });

  it("aponta só as conquistas novas", () => {
    expect(
      newlyUnlocked(["first-step"], ["first-step", "xp-collector"]).map(
        (a) => a.id,
      ),
    ).toEqual(["xp-collector"]);
    expect(newlyUnlocked(["first-step"], ["first-step"])).toEqual([]);
  });
});
