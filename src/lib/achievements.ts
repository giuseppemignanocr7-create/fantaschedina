// Sistema Achievements Avanzato per Fantaschedina

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'beginner' | 'intermediate' | 'expert' | 'legendary';
  points: number;
  condition: (stats: UserStats) => boolean;
  progress?: (stats: UserStats) => { current: number; target: number };
}

export interface UserStats {
  totalSchedine: number;
  correctPredictions: number;
  totalPredictions: number;
  weeklyWins: number;
  perfectSchedine: number;
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  rank: number;
  participantCount: number;
  highestOddsWon: number;
  pokerCount: number;
  comebackWins: number;
  firstPlaceFinishes: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // BEGINNER
  {
    id: 'first_schedina',
    name: 'Prima Schedina',
    description: 'Hai inviato la tua prima schedina',
    icon: '🎯',
    category: 'beginner',
    points: 10,
    condition: (s) => s.totalSchedine >= 1,
  },
  {
    id: 'week_5',
    name: 'Veterano',
    description: 'Hai partecipato a 5 giornate',
    icon: '📅',
    category: 'beginner',
    points: 20,
    condition: (s) => s.totalSchedine >= 5,
    progress: (s) => ({ current: Math.min(s.totalSchedine, 5), target: 5 }),
  },
  {
    id: 'first_correct',
    name: 'Primo Centro',
    description: 'Hai indovinato il tuo primo pronostico',
    icon: '✅',
    category: 'beginner',
    points: 5,
    condition: (s) => s.correctPredictions >= 1,
  },
  {
    id: 'accuracy_50',
    name: 'Sulla Buona Strada',
    description: 'Precisione superiore al 50%',
    icon: '📊',
    category: 'beginner',
    points: 15,
    condition: (s) => s.totalPredictions > 0 && (s.correctPredictions / s.totalPredictions) >= 0.5,
  },

  // INTERMEDIATE
  {
    id: 'week_10',
    name: 'Habitué',
    description: 'Hai partecipato a 10 giornate',
    icon: '🏠',
    category: 'intermediate',
    points: 30,
    condition: (s) => s.totalSchedine >= 10,
    progress: (s) => ({ current: Math.min(s.totalSchedine, 10), target: 10 }),
  },
  {
    id: 'first_win',
    name: 'Vincitore',
    description: 'Hai vinto la tua prima giornata',
    icon: '🏆',
    category: 'intermediate',
    points: 50,
    condition: (s) => s.weeklyWins >= 1,
  },
  {
    id: 'accuracy_60',
    name: 'Precisione 60%',
    description: 'Precisione superiore al 60%',
    icon: '🎯',
    category: 'intermediate',
    points: 25,
    condition: (s) => s.totalPredictions > 0 && (s.correctPredictions / s.totalPredictions) >= 0.6,
  },
  {
    id: 'streak_3',
    name: 'Costanza',
    description: '3 settimane consecutive di partecipazione',
    icon: '🔥',
    category: 'intermediate',
    points: 30,
    condition: (s) => s.currentStreak >= 3 || s.bestStreak >= 3,
    progress: (s) => ({ current: Math.min(s.bestStreak, 3), target: 3 }),
  },
  {
    id: 'top_10',
    name: 'Top 10',
    description: 'Sei entrato nella top 10 della classifica',
    icon: '📈',
    category: 'intermediate',
    points: 40,
    condition: (s) => s.rank <= 10 && s.rank > 0,
  },
  {
    id: 'high_odds',
    name: 'Rischiatore',
    description: 'Hai vinto con una quota superiore a 3.00',
    icon: '🎲',
    category: 'intermediate',
    points: 35,
    condition: (s) => s.highestOddsWon >= 3.0,
  },

  // EXPERT
  {
    id: 'week_20',
    name: 'Esperto',
    description: 'Hai partecipato a 20 giornate',
    icon: '🎓',
    category: 'expert',
    points: 50,
    condition: (s) => s.totalSchedine >= 20,
    progress: (s) => ({ current: Math.min(s.totalSchedine, 20), target: 20 }),
  },
  {
    id: 'wins_3',
    name: 'Tripla Corona',
    description: 'Hai vinto 3 giornate',
    icon: '👑',
    category: 'expert',
    points: 75,
    condition: (s) => s.weeklyWins >= 3,
    progress: (s) => ({ current: Math.min(s.weeklyWins, 3), target: 3 }),
  },
  {
    id: 'accuracy_70',
    name: 'Sniper',
    description: 'Precisione superiore al 70%',
    icon: '🔫',
    category: 'expert',
    points: 60,
    condition: (s) => s.totalPredictions > 0 && (s.correctPredictions / s.totalPredictions) >= 0.7,
  },
  {
    id: 'streak_5',
    name: 'Inarrestabile',
    description: '5 settimane consecutive di partecipazione',
    icon: '⚡',
    category: 'expert',
    points: 50,
    condition: (s) => s.currentStreak >= 5 || s.bestStreak >= 5,
    progress: (s) => ({ current: Math.min(s.bestStreak, 5), target: 5 }),
  },
  {
    id: 'top_3',
    name: 'Podio',
    description: 'Sei nei primi 3 in classifica generale',
    icon: '🥇',
    category: 'expert',
    points: 80,
    condition: (s) => s.rank <= 3 && s.rank > 0,
  },
  {
    id: 'poker',
    name: 'Poker!',
    description: 'Hai ottenuto il premio Poker (4 quote >2.00 vinte)',
    icon: '🃏',
    category: 'expert',
    points: 70,
    condition: (s) => s.pokerCount >= 1,
  },
  {
    id: 'perfect_schedina',
    name: 'Perfezionista',
    description: 'Hai fatto una schedina perfetta (15/15)',
    icon: '💯',
    category: 'expert',
    points: 100,
    condition: (s) => s.perfectSchedine >= 1,
  },

  // LEGENDARY
  {
    id: 'wins_5',
    name: 'Dominatore',
    description: 'Hai vinto 5 giornate',
    icon: '👊',
    category: 'legendary',
    points: 120,
    condition: (s) => s.weeklyWins >= 5,
    progress: (s) => ({ current: Math.min(s.weeklyWins, 5), target: 5 }),
  },
  {
    id: 'streak_10',
    name: 'Leggenda',
    description: '10 settimane consecutive di partecipazione',
    icon: '🌟',
    category: 'legendary',
    points: 100,
    condition: (s) => s.currentStreak >= 10 || s.bestStreak >= 10,
    progress: (s) => ({ current: Math.min(s.bestStreak, 10), target: 10 }),
  },
  {
    id: 'first_place',
    name: 'Campione',
    description: 'Sei primo in classifica generale',
    icon: '🏅',
    category: 'legendary',
    points: 150,
    condition: (s) => s.rank === 1,
  },
  {
    id: 'giant_killer',
    name: 'Giant Killer',
    description: 'Hai vinto con una quota superiore a 4.00',
    icon: '🗡️',
    category: 'legendary',
    points: 100,
    condition: (s) => s.highestOddsWon >= 4.0,
  },
  {
    id: 'comeback_king',
    name: 'Re della Rimonta',
    description: 'Da fuori top 10 a top 3 in una stagione',
    icon: '🦁',
    category: 'legendary',
    points: 150,
    condition: (s) => s.comebackWins >= 1,
  },
  {
    id: 'perfect_3',
    name: 'Maestro',
    description: '3 schedine perfette in carriera',
    icon: '🎭',
    category: 'legendary',
    points: 200,
    condition: (s) => s.perfectSchedine >= 3,
    progress: (s) => ({ current: Math.min(s.perfectSchedine, 3), target: 3 }),
  },
];

export function getUnlockedAchievements(stats: UserStats): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.condition(stats));
}

export function getLockedAchievements(stats: UserStats): Achievement[] {
  return ACHIEVEMENTS.filter(a => !a.condition(stats));
}

export function getAchievementProgress(stats: UserStats): {
  unlocked: number;
  total: number;
  percentage: number;
  totalPoints: number;
  earnedPoints: number;
} {
  const unlocked = getUnlockedAchievements(stats);
  return {
    unlocked: unlocked.length,
    total: ACHIEVEMENTS.length,
    percentage: Math.round((unlocked.length / ACHIEVEMENTS.length) * 100),
    totalPoints: ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0),
    earnedPoints: unlocked.reduce((sum, a) => sum + a.points, 0),
  };
}

export function getAchievementsByCategory(stats: UserStats): Record<string, { unlocked: Achievement[]; locked: Achievement[] }> {
  const categories = ['beginner', 'intermediate', 'expert', 'legendary'] as const;
  
  return categories.reduce((acc, category) => {
    const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category);
    acc[category] = {
      unlocked: categoryAchievements.filter(a => a.condition(stats)),
      locked: categoryAchievements.filter(a => !a.condition(stats)),
    };
    return acc;
  }, {} as Record<string, { unlocked: Achievement[]; locked: Achievement[] }>);
}

export function getNextAchievements(stats: UserStats, limit = 3): Achievement[] {
  const locked = getLockedAchievements(stats);
  
  // Prioritizza quelli con progress più vicino al completamento
  return locked
    .map(a => ({
      achievement: a,
      progress: a.progress ? a.progress(stats).current / a.progress(stats).target : 0,
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit)
    .map(a => a.achievement);
}
