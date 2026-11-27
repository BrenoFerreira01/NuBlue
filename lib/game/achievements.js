// Conquistas do perfil, calculadas a partir do progresso do aluno.

export const ACHIEVEMENTS = [
  {
    id: "first-step",
    emoji: "🏁",
    name: "Primeiro Passo",
    desc: () => "Complete qualquer nível",
    unlocked: (s) => s.completedLevels.length >= 1,
  },
  {
    id: "trail-master",
    emoji: "🎓",
    name: "Mestre da trilha",
    desc: (s) => `Complete os ${s.totalLevels} níveis dos cinco capítulos`,
    unlocked: (s) =>
      s.totalLevels > 0 && s.completedLevels.length >= s.totalLevels,
  },
  {
    id: "challenger",
    emoji: "⚔️",
    name: "Desafiador",
    desc: () => "Acerte sua primeira cruzadinha no desafio",
    unlocked: (s) => s.dailyChallengesCompleted >= 1,
  },
  {
    id: "on-fire",
    emoji: "🔥",
    name: "Em Chamas",
    desc: () => "Mantenha 7 dias de sequência",
    unlocked: (s) => s.streak >= 7,
  },
  {
    id: "xp-collector",
    emoji: "💎",
    name: "Colecionador de XP",
    desc: () => "Acumule 100 XP no total",
    unlocked: (s) => s.xp >= 100,
  },
  {
    id: "unstoppable",
    emoji: "🌪️",
    name: "Imparável",
    desc: () => "Jogue o desafio por 7 dias seguidos",
    unlocked: (s) => s.bestDailyStreak >= 7,
  },
];

/** Ids das conquistas já desbloqueadas com este progresso. */
export const unlockedIds = (stats) =>
  ACHIEVEMENTS.filter((a) => a.unlocked(stats)).map((a) => a.id);

/** Conquistas em `current` que ainda não estavam em `previous`. */
export const newlyUnlocked = (previous, current) =>
  ACHIEVEMENTS.filter(
    (a) => current.includes(a.id) && !previous.includes(a.id),
  );
