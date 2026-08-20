// ============================================
// FANTASCHEDINA FUNCTIONS - CLASSIFICA (funzioni pure)
//
// Stessa logica di `src/lib/rankings.ts`, portata lato server perché la
// classifica venga calcolata una volta sola invece che da ogni client dopo
// aver scaricato tutti i profili. Le due copie sono confrontate dal test
// `src/lib/__tests__/rankingsMirror.test.ts`: se divergono, la classifica
// mostrata e quella ufficiale non sarebbero più la stessa cosa.
//
// Tie-break da regolamento: punti totali, pronostici esatti, miglior giornata,
// username. A parità piena il rank è condiviso (1, 2, 2, 4).
// ============================================

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
}

export interface RankingEntry {
  rank: number;
  participantId: string;
  username: string;
  totalPoints: number;
  matchdaysPlayed: number;
  correctPredictions: number;
  averagePointsPerMatchday: number;
  bestMatchdayPoints: number;
  perfectSchedine: number;
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
}

function compareProfiles(a: RankableProfile, b: RankableProfile): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.correctPredictions !== a.correctPredictions) {
    return b.correctPredictions - a.correctPredictions;
  }
  if (b.bestMatchdayPoints !== a.bestMatchdayPoints) {
    return b.bestMatchdayPoints - a.bestMatchdayPoints;
  }
  return a.username.localeCompare(b.username);
}

function isTied(a: RankableProfile, b: RankableProfile): boolean {
  return (
    a.totalPoints === b.totalPoints &&
    a.correctPredictions === b.correctPredictions &&
    a.bestMatchdayPoints === b.bestMatchdayPoints
  );
}

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
