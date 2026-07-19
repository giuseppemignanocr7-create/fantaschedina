// ============================================
// TEST RANKING ENGINE
// Tie-break deterministici e competition ranking (1,2,2,4)
// ============================================
import { describe, it, expect } from 'vitest';
import {
  computeRankings,
  computeArcadeRankings,
  computeWeeklyRanking,
  type RankableProfile,
  type WeeklySchedina,
} from '../rankings';

function profile(over: Partial<RankableProfile> & { id: string; username: string }): RankableProfile {
  return {
    totalPoints: 0,
    matchdaysPlayed: 0,
    correctPredictions: 0,
    bestMatchdayPoints: 0,
    perfectSchedine: 0,
    bonusPointsTotal: 0,
    penaltyPointsTotal: 0,
    weeklyWins: 0,
    ...over,
  };
}

describe('computeRankings — ordinamento e tie-break', () => {
  it('ordina per punti decrescenti', () => {
    const r = computeRankings([
      profile({ id: 'a', username: 'Anna', totalPoints: 100 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 300 }),
      profile({ id: 'c', username: 'Carla', totalPoints: 200 }),
    ]);
    expect(r.map(e => e.participantId)).toEqual(['b', 'c', 'a']);
    expect(r.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it('a pari punti vince chi ha più pronostici esatti', () => {
    const r = computeRankings([
      profile({ id: 'a', username: 'Anna', totalPoints: 200, correctPredictions: 50 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 200, correctPredictions: 70 }),
    ]);
    expect(r[0].participantId).toBe('b');
  });

  it('a pari punti ed esatti vince la miglior giornata', () => {
    const r = computeRankings([
      profile({ id: 'a', username: 'Anna', totalPoints: 200, correctPredictions: 50, bestMatchdayPoints: 180 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 200, correctPredictions: 50, bestMatchdayPoints: 250 }),
    ]);
    expect(r[0].participantId).toBe('b');
  });

  it('parità totale → stesso rank, poi salto (1,2,2,4)', () => {
    const r = computeRankings([
      profile({ id: 'a', username: 'Anna', totalPoints: 300 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 200 }),
      profile({ id: 'c', username: 'Carla', totalPoints: 200 }),
      profile({ id: 'd', username: 'Dino', totalPoints: 100 }),
    ]);
    expect(r.map(e => e.rank)).toEqual([1, 2, 2, 4]);
  });

  it('parità totale → ordinamento stabile per username', () => {
    const r = computeRankings([
      profile({ id: 'z', username: 'Zeno', totalPoints: 100 }),
      profile({ id: 'a', username: 'Anna', totalPoints: 100 }),
    ]);
    expect(r.map(e => e.username)).toEqual(['Anna', 'Zeno']);
  });

  it('media punti arrotondata a 2 decimali, 0 se mai giocato', () => {
    const r = computeRankings([
      profile({ id: 'a', username: 'Anna', totalPoints: 100, matchdaysPlayed: 3 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 0, matchdaysPlayed: 0 }),
    ]);
    expect(r[0].averagePointsPerMatchday).toBe(33.33);
    expect(r[1].averagePointsPerMatchday).toBe(0);
  });

  it('input vuoto → classifica vuota', () => {
    expect(computeRankings([])).toEqual([]);
  });

  it('non muta l\'array in input', () => {
    const input = [
      profile({ id: 'a', username: 'Anna', totalPoints: 1 }),
      profile({ id: 'b', username: 'Bruno', totalPoints: 2 }),
    ];
    const copy = [...input];
    computeRankings(input);
    expect(input).toEqual(copy);
  });
});

describe('computeArcadeRankings', () => {
  it('ordina per gettoni guadagnati, tie-break su gettoni attuali poi username', () => {
    const r = computeArcadeRankings([
      profile({ id: 'a', username: 'Anna', coinsEarned: 50, coins: 10 }),
      profile({ id: 'b', username: 'Bruno', coinsEarned: 100, coins: 5 }),
      profile({ id: 'c', username: 'Carla', coinsEarned: 50, coins: 30 }),
    ]);
    expect(r.map(e => e.participantId)).toEqual(['b', 'c', 'a']);
  });

  it('parità di guadagni → stesso rank', () => {
    const r = computeArcadeRankings([
      profile({ id: 'a', username: 'Anna', coinsEarned: 50 }),
      profile({ id: 'b', username: 'Bruno', coinsEarned: 50 }),
      profile({ id: 'c', username: 'Carla', coinsEarned: 10 }),
    ]);
    expect(r.map(e => e.rank)).toEqual([1, 1, 3]);
  });

  it('campi mancanti trattati come 0 senza crash', () => {
    const r = computeArcadeRankings([profile({ id: 'a', username: 'Anna' })]);
    expect(r[0].coinsEarned).toBe(0);
    expect(r[0].coins).toBe(0);
  });
});

describe('computeWeeklyRanking', () => {
  const names = { u1: 'Anna', u2: 'Bruno', u3: 'Carla' };
  const sched = (over: Partial<WeeklySchedina> & { userId: string }): WeeklySchedina => ({
    matchdayNumber: 5,
    settled: true,
    finalPoints: 0,
    correctPredictions: 0,
    ...over,
  });

  it('include solo le schedine valutate della giornata giusta', () => {
    const w = computeWeeklyRanking(5, [
      sched({ userId: 'u1', finalPoints: 100 }),
      sched({ userId: 'u2', finalPoints: 200, matchdayNumber: 4 }), // altra giornata
      sched({ userId: 'u3', finalPoints: 300, settled: false }),     // non valutata
    ], names);
    expect(w.entries).toHaveLength(1);
    expect(w.entries[0].participantId).toBe('u1');
  });

  it('ordina per punti finali, il vincitore è il primo', () => {
    const w = computeWeeklyRanking(5, [
      sched({ userId: 'u1', finalPoints: 150 }),
      sched({ userId: 'u2', finalPoints: 220 }),
      sched({ userId: 'u3', finalPoints: 90 }),
    ], names);
    expect(w.winner?.participantId).toBe('u2');
    expect(w.entries.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it('parità di punti ed esatti → stesso rank', () => {
    const w = computeWeeklyRanking(5, [
      sched({ userId: 'u1', finalPoints: 100, correctPredictions: 5 }),
      sched({ userId: 'u2', finalPoints: 100, correctPredictions: 5 }),
      sched({ userId: 'u3', finalPoints: 50 }),
    ], names);
    expect(w.entries.map(e => e.rank)).toEqual([1, 1, 3]);
  });

  it('10/10 conta come schedina perfetta', () => {
    const w = computeWeeklyRanking(5, [
      sched({ userId: 'u1', finalPoints: 300, correctPredictions: 10 }),
    ], names);
    expect(w.entries[0].perfectSchedine).toBe(1);
  });

  it('nessuna schedina → nessun vincitore', () => {
    const w = computeWeeklyRanking(5, [], names);
    expect(w.entries).toEqual([]);
    expect(w.winner).toBeUndefined();
  });

  it('username mancante → fallback su userId', () => {
    const w = computeWeeklyRanking(5, [sched({ userId: 'ghost', finalPoints: 10 })], {});
    expect(w.entries[0].username).toBe('ghost');
  });
});
