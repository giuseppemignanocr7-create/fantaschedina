// Test del motore di settlement server-side (functions/src/scoring.ts)
// incluso il comportamento dei power-up.
import { describe, it, expect } from 'vitest';
import {
  evaluateSchedina,
  evaluateBet,
  attendeParziale,
  livelloBonus,
  partitaAnnullata,
  statoGiornata,
  ORE_ATTESA_RISULTATO,
  type MatchResult,
  type Prediction,
} from '../../../functions/src/scoring';

const res = (h: number, a: number): MatchResult => ({
  homeGoals: h,
  awayGoals: a,
  outcome: h > a ? '1' : a > h ? '2' : 'X',
});

function tenPredictions(odds = 2.0): Prediction[] {
  return Array.from({ length: 10 }, (_, i) => ({
    matchId: `m${i}`,
    betType: 'esito',
    outcome: '1',
    odds,
  }));
}

function resultsMap(correct: number): Map<string, MatchResult> {
  // Le prime `correct` partite finiscono 1 (vinte), le altre 2 (perse)
  return new Map(
    Array.from({ length: 10 }, (_, i) => [
      `m${i}`,
      i < correct ? res(2, 0) : res(0, 2),
    ])
  );
}

// Stesso arrotondamento progressivo usato da evaluateSchedina, per calcolare
// i valori attesi senza duplicare la logica interna a mano. `base` è già in
// punti (quota × 10), `bonus` è in punti pieni.
function expectedTotals(base: number, bonus: number, penaltyMultiplier: number) {
  const totalPoints = Math.round(base * 100) / 100;
  const afterPenalty = Math.round(totalPoints * penaltyMultiplier * 100) / 100;
  const penaltyPoints = Math.round((afterPenalty - totalPoints) * 100) / 100;
  return {
    totalPoints,
    bonusPoints: bonus,
    penaltyPoints,
    finalPoints: Math.round((afterPenalty + bonus) * 100) / 100,
  };
}

describe('functions evaluateSchedina', () => {
  it('senza power-up: 10/10 → quote ×10 sommate, più 10 punti di bonus', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10));
    const expected = expectedTotals(10 * 20, 10, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
    expect(s.bonusPoints).toBeCloseTo(expected.bonusPoints);
    expect(s.finalPoints).toBeCloseTo(expected.finalPoints);
  });

  it('jolly raddoppia il contributo del pronostico scelto (se vinto)', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(10), { jolly: 'm0' });
    // m0: 20 → 40 punti (raddoppiato), le altre 9 restano da 20
    const base = 40 + 9 * 20;
    const expected = expectedTotals(base, 10, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
  });

  it('jolly su pronostico perso non raddoppia nulla', () => {
    const s = evaluateSchedina(tenPredictions(), resultsMap(5), { jolly: 'm9' });
    // m9 è tra le perse (solo m0-m4 corrette): il jolly non si applica
    const expected = expectedTotals(5 * 20, 0, 1);
    expect(s.totalPoints).toBeCloseTo(expected.totalPoints);
  });

  it('shield annulla il moltiplicatore di penalità quote basse', () => {
    const preds = tenPredictions(1.27); // fascia penalità, tutte e 10
    const combo = 10 * 12.7;
    const noShield = evaluateSchedina(preds, resultsMap(10));
    // 10/10 corrette → il bonus di 10 punti si somma comunque; la penalità
    // (10 giocate in fascia → 3 set → ×0.9^3) colpisce solo i punti giocati.
    const expectedNoShield = expectedTotals(combo, 10, Math.pow(0.9, 3));
    expect(noShield.penaltyPoints).toBeCloseTo(expectedNoShield.penaltyPoints);
    expect(noShield.finalPoints).toBeCloseTo(expectedNoShield.finalPoints);

    const withShield = evaluateSchedina(preds, resultsMap(10), { shield: true });
    const expectedShield = expectedTotals(combo, 10, 1);
    expect(withShield.penaltyPoints).toBe(0);
    expect(withShield.finalPoints).toBeCloseTo(expectedShield.finalPoints);
  });

  it('insurance: 8/10 riceve il bonus del 9/10 (+5 punti)', () => {
    const without = evaluateSchedina(tenPredictions(), resultsMap(8));
    expect(without.bonusPoints).toBe(0);

    const withIns = evaluateSchedina(tenPredictions(), resultsMap(8), {
      insurance: true,
    });
    const expected = expectedTotals(8 * 20, 5, 1);
    expect(withIns.bonusPoints).toBeCloseTo(expected.bonusPoints);
  });

  it('partita senza risultato → non corretta, contributo 0', () => {
    const preds: Prediction[] = [
      { matchId: 'mX', betType: 'esito', outcome: '1', odds: 3.0 },
    ];
    const s = evaluateSchedina(preds, new Map());
    expect(s.predictionResults[0].isVoid).toBe(true);
    expect(s.predictionResults[0].isCorrect).toBe(false);
    expect(s.predictionResults[0].pointsEarned).toBe(0);
    expect(s.finalPoints).toBe(0);
  });

  it('mercato non valutabile (void) → NON corretto, 0 punti', () => {
    // esito_1t senza dato HT nel risultato → evaluateBet ritorna null (void)
    const preds: Prediction[] = [
      { matchId: 'mY', betType: 'esito_1t', outcome: '1', odds: 3.0 },
    ];
    const s = evaluateSchedina(preds, new Map([['mY', res(2, 0)]]));
    expect(s.predictionResults[0].isVoid).toBe(true);
    expect(s.predictionResults[0].isCorrect).toBe(false);
    expect(s.predictionResults[0].pointsEarned).toBe(0);
    expect(s.correctPredictions).toBe(0);
    expect(s.totalPoints).toBe(0);
    expect(s.bonusPoints).toBe(0);
  });

  it('mercato inventato dal client (constructor) → annullato, mai esatto', () => {
    const preds: Prediction[] = [
      { matchId: 'm0', betType: 'constructor', outcome: 'name', odds: 1 },
    ];
    const s = evaluateSchedina(preds, resultsMap(10));
    expect(s.predictionResults[0]).toMatchObject({ isVoid: true, isCorrect: false });
    expect(s.bonusPoints).toBe(0);
  });

  it('un annullato non aiuta a raggiungere il bonus: 9 esatti + 1 annullato = +5, non +10', () => {
    const results = resultsMap(10);
    results.delete('m9'); // partita rinviata: nessun risultato
    const s = evaluateSchedina(tenPredictions(), results);
    expect(s.correctPredictions).toBe(9);
    expect(s.bonusPoints).toBe(5);
    expect(s.predictionResults[9]).toMatchObject({ isVoid: true, isCorrect: false });
  });

  it('8 esatti + 2 annullati: nessun bonus', () => {
    const results = resultsMap(10);
    results.delete('m8');
    results.delete('m9');
    const s = evaluateSchedina(tenPredictions(), results);
    expect(s.correctPredictions).toBe(8);
    expect(s.bonusPoints).toBe(0);
  });

  it('schedina corta (8 richiesti): +10 con 8 esatti, niente +5 con 7', () => {
    const otto = tenPredictions().slice(0, 8);
    expect(evaluateSchedina(otto, resultsMap(10)).bonusPoints).toBe(10);
    expect(evaluateSchedina(otto, resultsMap(7)).bonusPoints).toBe(0);
    // Con 8 richiesti l'assicurazione non ha un +5 da anticipare.
    expect(evaluateSchedina(otto, resultsMap(6), { insurance: true }).bonusPoints).toBe(0);
  });

  it('schedina da 9: +10 con 9 esatti, +5 con 8, insurance +5 con 7', () => {
    const nove = tenPredictions().slice(0, 9);
    expect(evaluateSchedina(nove, resultsMap(10)).bonusPoints).toBe(10);
    expect(evaluateSchedina(nove, resultsMap(8)).bonusPoints).toBe(5);
    expect(evaluateSchedina(nove, resultsMap(7)).bonusPoints).toBe(0);
    expect(evaluateSchedina(nove, resultsMap(7), { insurance: true }).bonusPoints).toBe(5);
  });

  it('richieste esplicite: dieci richiesti ma nove pronostici non danno il +10', () => {
    const nove = tenPredictions().slice(0, 9);
    expect(evaluateSchedina(nove, resultsMap(10), {}, 10).bonusPoints).toBe(5);
  });
});

describe('functions livelloBonus', () => {
  it.each([
    [10, 10, 'pieno'],
    [9, 10, 'quasi'],
    [8, 10, null],
    [9, 9, 'pieno'],
    [8, 9, 'quasi'],
    [8, 8, 'pieno'],
    [7, 8, null],
    [0, 0, null],
  ] as const)('%i esatti su %i → %s', (corretti, richieste, atteso) => {
    expect(livelloBonus(corretti, richieste)).toBe(atteso);
  });
});

describe('functions statoGiornata', () => {
  const ORA = Date.UTC(2026, 8, 25, 12);
  const H = 60 * 60 * 1000;
  const finita = (id: string, ht = true) => ({
    id,
    status: 'finished',
    kickoffMs: ORA - 3 * H,
    result: { ...res(2, 1), ...(ht ? { htHomeGoals: 1, htAwayGoals: 0 } : {}) },
    confermata: true,
  });

  it('partite finite: tutte nei risultati, niente attese', () => {
    const s = statoGiornata([finita('a'), finita('b')], ORA);
    expect([...s.risultati.keys()]).toEqual(['a', 'b']);
    expect(s.inAttesa).toEqual([]);
    expect(s.annullate).toEqual([]);
  });

  it.each(['postponed', 'canceled', 'cancelled', 'abandoned', 'POSTPONED'])(
    'stato %s → annullata, senza risultato',
    status => {
      const s = statoGiornata([{ id: 'a', status, kickoffMs: ORA - H, confermata: true }], ORA);
      expect(s.annullate).toEqual(['a']);
      expect(s.risultati.has('a')).toBe(false);
      expect(s.inAttesa).toEqual([]);
    }
  );

  it('partita in corso: si aspetta', () => {
    const s = statoGiornata([{ id: 'a', status: 'live', kickoffMs: ORA - H, confermata: true }], ORA);
    expect(s.inAttesa).toEqual(['a']);
  });

  it('mai finita dopo 50 ore dal fischio: annullata se il fornitore lo conferma', () => {
    const vecchia = { id: 'a', status: 'scheduled', kickoffMs: ORA - (ORE_ATTESA_RISULTATO + 1) * H };
    expect(statoGiornata([{ ...vecchia, confermata: true }], ORA).annullate).toEqual(['a']);
    // Il fornitore non ha risposto: si aspetta ancora, fino a una settimana.
    expect(statoGiornata([{ ...vecchia, confermata: false }], ORA).inAttesa).toEqual(['a']);
    const settimana = { ...vecchia, kickoffMs: ORA - 8 * 24 * H, confermata: false };
    expect(statoGiornata([settimana], ORA).annullate).toEqual(['a']);
  });

  it('forza: cio\' che non e\' finito e\' annullato subito, mai un risultato inventato', () => {
    const s = statoGiornata(
      [finita('a'), { id: 'b', status: 'live', kickoffMs: ORA - H, confermata: true }],
      ORA,
      true
    );
    expect(s.annullate).toEqual(['b']);
    expect(s.risultati.has('b')).toBe(false);
    expect(s.inAttesa).toEqual([]);
  });

  it('parziale mancante: segnalato finche\' non passano 50 ore, poi si valuta senza', () => {
    expect(statoGiornata([finita('a', false)], ORA).senzaParziale).toEqual(['a']);
    const tardi = { ...finita('a', false), kickoffMs: ORA - (ORE_ATTESA_RISULTATO + 1) * H };
    const s = statoGiornata([tardi], ORA);
    expect(s.senzaParziale).toEqual([]);
    expect(s.risultati.has('a')).toBe(true);
    expect(statoGiornata([finita('a', false)], ORA, true).senzaParziale).toEqual([]);
  });
});

describe('functions attendeParziale', () => {
  const pred = (matchId: string, betType: string): Prediction => ({
    matchId,
    betType,
    outcome: '1',
    odds: 2,
  });

  it('solo i mercati di primo tempo sulle partite senza parziale aspettano', () => {
    expect(attendeParziale([pred('a', 'esito_1t')], ['a'])).toBe(true);
    expect(attendeParziale([pred('a', 'over_under_1t')], ['a'])).toBe(true);
    expect(attendeParziale([pred('a', 'esito')], ['a'])).toBe(false);
    expect(attendeParziale([pred('b', 'esito_1t')], ['a'])).toBe(false);
    expect(attendeParziale([pred('a', 'esito_1t')], [])).toBe(false);
  });

  it('partitaAnnullata riconosce le grafie e ignora il resto', () => {
    expect(partitaAnnullata('cancelled')).toBe(true);
    expect(partitaAnnullata('finished')).toBe(false);
    expect(partitaAnnullata(undefined)).toBe(false);
  });
});

describe('functions evaluateBet coerente col client', () => {
  it('over/under, GG/NG, DC', () => {
    expect(evaluateBet('over_under', 'OVER', res(2, 1))).toBe(true);
    expect(evaluateBet('goal_nogoal', 'GG', res(1, 1))).toBe(true);
    expect(evaluateBet('doppia_chance', 'X2', res(0, 0))).toBe(true);
    expect(evaluateBet('multigoal', 'U1.5', res(1, 0))).toBe(true);
  });
});
