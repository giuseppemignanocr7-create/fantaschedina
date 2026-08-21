// ============================================
// ALLINEAMENTO CLASSIFICA CLIENT ↔ SERVER
//
// La classifica ufficiale la calcola il server (callable `getRankings`), ma la
// stessa logica resta lato client per le classifiche locali. Due copie della
// stessa regola divergono in silenzio: qui vengono confrontate sugli stessi
// dati, compresi i casi di parità, che sono quelli in cui una differenza si
// vedrebbe davvero.
// ============================================

import { describe, it, expect } from 'vitest';
import { computeRankings as computeClient } from '../rankings';
import { computeRankings as computeServer } from '../../../functions/src/rankings';

interface Profilo {
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

function profilo(over: Partial<Profilo> & { id: string; username: string }): Profilo {
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

const scenari: { nome: string; profili: Profilo[] }[] = [
  { nome: 'nessun partecipante', profili: [] },
  {
    nome: 'un solo partecipante',
    profili: [profilo({ id: 'a', username: 'Anna', totalPoints: 12, matchdaysPlayed: 3 })],
  },
  {
    nome: 'ordine per punti',
    profili: [
      profilo({ id: 'a', username: 'Anna', totalPoints: 10, matchdaysPlayed: 2 }),
      profilo({ id: 'b', username: 'Bruno', totalPoints: 45, matchdaysPlayed: 2 }),
      profilo({ id: 'c', username: 'Carla', totalPoints: 27, matchdaysPlayed: 2 }),
    ],
  },
  {
    nome: 'parità di punti, decide il numero di esatti',
    profili: [
      profilo({ id: 'a', username: 'Anna', totalPoints: 40, correctPredictions: 12 }),
      profilo({ id: 'b', username: 'Bruno', totalPoints: 40, correctPredictions: 19 }),
    ],
  },
  {
    nome: 'parità piena: rank condiviso',
    profili: [
      profilo({ id: 'a', username: 'Anna', totalPoints: 40, correctPredictions: 10, bestMatchdayPoints: 20 }),
      profilo({ id: 'b', username: 'Bruno', totalPoints: 40, correctPredictions: 10, bestMatchdayPoints: 20 }),
      profilo({ id: 'c', username: 'Carla', totalPoints: 5 }),
    ],
  },
  {
    nome: 'giornate a zero (media non calcolabile)',
    profili: [
      profilo({ id: 'a', username: 'Anna', totalPoints: 0, matchdaysPlayed: 0 }),
      profilo({ id: 'b', username: 'Bruno', totalPoints: 30, matchdaysPlayed: 7 }),
    ],
  },
  {
    nome: 'username con accenti e maiuscole miste',
    profili: [
      profilo({ id: 'a', username: 'Ãlvaro', totalPoints: 10 }),
      profilo({ id: 'b', username: 'alberto', totalPoints: 10 }),
      profilo({ id: 'c', username: 'Zeno', totalPoints: 10 }),
    ],
  },
];

describe('computeRankings — client e server danno la stessa classifica', () => {
  it.each(scenari.map(s => ({ nome: s.nome, profili: s.profili })))(
    '$nome',
    ({ profili }) => {
      expect(computeServer(profili)).toEqual(computeClient(profili));
    }
  );

  it('anche cambiando l\'ordine di partenza', () => {
    const profili = scenari[4].profili;
    const invertiti = [...profili].reverse();
    expect(computeServer(invertiti)).toEqual(computeClient(invertiti));
    expect(computeServer(invertiti)).toEqual(computeServer(profili));
  });

  it('su un elenco grande generato in modo deterministico', () => {
    const profili = Array.from({ length: 200 }, (_, i) =>
      profilo({
        id: `u${i}`,
        username: `Player${(i * 7) % 200}`,
        totalPoints: (i * 13) % 50,
        matchdaysPlayed: i % 9,
        correctPredictions: (i * 3) % 30,
        bestMatchdayPoints: (i * 5) % 25,
      })
    );
    expect(computeServer(profili)).toEqual(computeClient(profili));
  });
});
