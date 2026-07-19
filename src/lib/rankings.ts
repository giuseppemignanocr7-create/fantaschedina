// ============================================
// FANTA SCHEDINA - RANKING ENGINE (funzioni pure)
// Ordinamento deterministico con tie-break dal regolamento:
// 1. Punti totali  2. Pronostici esatti  3. Miglior giornata  4. Username (stabile)
// Rank condiviso in caso di parità totale (competition ranking: 1,2,2,4).
// ============================================
import type { RankingEntry, WeeklyRanking } from '@/types';

export interface RankableProfile {
  id: string;
  username: string;
  totalPoints: number;
  matchdaysPlayed: number;
  correctPredictions: number;
  bestMatchdayPoints: number;
  perfectSchedine: number;
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
  coins?: number;
  coinsEarned?: number;
}

export interface ArcadeEntry {
  rank: number;
  participantId: string;
  username: string;
  coinsEarned: number;
  coins: number;
}

export interface WeeklySchedina {
  userId: string;
  matchdayNumber: number;
  settled?: boolean;
  finalPoints?: number;
  correctPredictions?: number;
  bonusPoints?: number;
  penaltyPoints?: number;
}

/** Confronto principale: punti > esatti > miglior giornata > username. */
function compareProfiles(a: RankableProfile, b: RankableProfile): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.correctPredictions !== a.correctPredictions)
    return b.correctPredictions - a.correctPredictions;
  if (b.bestMatchdayPoints !== a.bestMatchdayPoints)
    return b.bestMatchdayPoints - a.bestMatchdayPoints;
  return a.username.localeCompare(b.username);
}

/** True se due profili sono in parità totale (stesso rank). */
function isTied(a: RankableProfile, b: RankableProfile): boolean {
  return (
    a.totalPoints === b.totalPoints &&
    a.correctPredictions === b.correctPredictions &&
    a.bestMatchdayPoints === b.bestMatchdayPoints
  );
}

/** Classifica generale con competition ranking (1,2,2,4). */
export function computeRankings(profiles: RankableProfile[]): RankingEntry[] {
  const sorted = [...profiles].sort(compareProfiles);
  const entries: RankingEntry[] = [];
  sorted.forEach((p, idx) => {
    const rank = idx > 0 && isTied(p, sorted[idx - 1]) ? entries[idx - 1].rank : idx + 1;
    entries.push({
      rank,
      participantId: p.id,
      username: p.username,
      totalPoints: p.totalPoints,
      matchdaysPlayed: p.matchdaysPlayed,
      correctPredictions: p.correctPredictions,
      averagePointsPerMatchday:
        p.matchdaysPlayed > 0
          ? Math.round((p.totalPoints / p.matchdaysPlayed) * 100) / 100
          : 0,
      bestMatchdayPoints: p.bestMatchdayPoints,
      perfectSchedine: p.perfectSchedine,
      bonusPointsTotal: p.bonusPointsTotal,
      penaltyPointsTotal: p.penaltyPointsTotal,
      weeklyWins: p.weeklyWins,
    });
  });
  return entries;
}

/** Classifica arcade: gettoni guadagnati, tie-break su gettoni attuali poi username. */
export function computeArcadeRankings(profiles: RankableProfile[]): ArcadeEntry[] {
  const sorted = [...profiles].sort((a, b) => {
    const ea = a.coinsEarned ?? 0;
    const eb = b.coinsEarned ?? 0;
    if (eb !== ea) return eb - ea;
    const ca = a.coins ?? 0;
    const cb = b.coins ?? 0;
    if (cb !== ca) return cb - ca;
    return a.username.localeCompare(b.username);
  });
  const entries: ArcadeEntry[] = [];
  sorted.forEach((p, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const tied = prev != null && (prev.coinsEarned ?? 0) === (p.coinsEarned ?? 0);
    entries.push({
      rank: tied ? entries[idx - 1].rank : idx + 1,
      participantId: p.id,
      username: p.username,
      coinsEarned: p.coinsEarned ?? 0,
      coins: p.coins ?? 0,
    });
  });
  return entries;
}

/**
 * Classifica di giornata dalle schedine valutate.
 * Le schedine non ancora valutate non compaiono (nessun punteggio da mostrare).
 */
export function computeWeeklyRanking(
  matchday: number,
  schedine: WeeklySchedina[],
  usernames: Record<string, string>
): WeeklyRanking {
  const settled = schedine.filter(
    s => s.matchdayNumber === matchday && s.settled && s.finalPoints != null
  );
  const sorted = [...settled].sort((a, b) => {
    if ((b.finalPoints ?? 0) !== (a.finalPoints ?? 0))
      return (b.finalPoints ?? 0) - (a.finalPoints ?? 0);
    if ((b.correctPredictions ?? 0) !== (a.correctPredictions ?? 0))
      return (b.correctPredictions ?? 0) - (a.correctPredictions ?? 0);
    return (usernames[a.userId] ?? a.userId).localeCompare(usernames[b.userId] ?? b.userId);
  });
  const entries: RankingEntry[] = sorted.map((s, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const tied =
      prev != null &&
      (prev.finalPoints ?? 0) === (s.finalPoints ?? 0) &&
      (prev.correctPredictions ?? 0) === (s.correctPredictions ?? 0);
    return {
      rank: tied ? idx : idx + 1, // idx punta all'entry precedente (stesso rank)
      participantId: s.userId,
      username: usernames[s.userId] ?? s.userId,
      totalPoints: s.finalPoints ?? 0,
      matchdaysPlayed: 1,
      correctPredictions: s.correctPredictions ?? 0,
      averagePointsPerMatchday: s.finalPoints ?? 0,
      bestMatchdayPoints: s.finalPoints ?? 0,
      perfectSchedine: (s.correctPredictions ?? 0) === 10 ? 1 : 0,
      bonusPointsTotal: s.bonusPoints ?? 0,
      penaltyPointsTotal: s.penaltyPoints ?? 0,
      weeklyWins: 0,
    };
  });
  // Correggi i rank condivisi (competition ranking)
  entries.forEach((e, idx) => {
    if (idx > 0 && e.rank === idx) e.rank = entries[idx - 1].rank;
  });
  return {
    matchday,
    entries,
    winner: entries.length > 0 ? entries[0] : undefined,
  };
}
