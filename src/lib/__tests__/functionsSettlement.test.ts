// Vincitore di giornata (functions/src/settlement.ts).
//
// Regressione principale: prima il vincitore era la prima schedina restituita
// da Firestore con il punteggio più alto, quindi a parità di punti il premio
// da 100 gettoni dipendeva dall'ordine dei documenti.
import { describe, it, expect } from 'vitest';
import {
  pickWeeklyWinner,
  type WeeklyCandidate,
} from '../../../functions/src/settlement';

function candidato(
  userId: string,
  finalPoints: number,
  correctPredictions = 5,
  submittedAtMs?: number
): WeeklyCandidate {
  return { userId, finalPoints, correctPredictions, submittedAtMs };
}

describe('pickWeeklyWinner', () => {
  it('nessun partecipante, nessun vincitore', () => {
    expect(pickWeeklyWinner([])).toBeNull();
  });

  it('vince chi ha più punti', () => {
    const winner = pickWeeklyWinner([
      candidato('a', 30),
      candidato('b', 45),
      candidato('c', 12),
    ]);
    expect(winner?.userId).toBe('b');
  });

  it('a parità di punti vince chi ha più pronostici esatti', () => {
    const winner = pickWeeklyWinner([
      candidato('a', 40, 7),
      candidato('b', 40, 9),
    ]);
    expect(winner?.userId).toBe('b');
  });

  it('a parità di punti ed esatti vince chi ha consegnato prima', () => {
    const winner = pickWeeklyWinner([
      candidato('tardivo', 40, 8, 2_000),
      candidato('mattiniero', 40, 8, 1_000),
    ]);
    expect(winner?.userId).toBe('mattiniero');
  });

  it('chi non ha un orario di invio non batte chi ce l\'ha', () => {
    const winner = pickWeeklyWinner([
      candidato('senzaOrario', 40, 8, undefined),
      candidato('conOrario', 40, 8, 5_000),
    ]);
    expect(winner?.userId).toBe('conOrario');
  });

  it('parità totale: vince sempre lo stesso, non il primo arrivato', () => {
    const a = candidato('zzz', 40, 8, 1_000);
    const b = candidato('aaa', 40, 8, 1_000);
    expect(pickWeeklyWinner([a, b])?.userId).toBe('aaa');
    expect(pickWeeklyWinner([b, a])?.userId).toBe('aaa');
  });

  it('REGRESSIONE: il risultato non dipende dall\'ordine dei documenti', () => {
    const candidati = [
      candidato('a', 40, 8, 1_000),
      candidato('b', 40, 8, 1_000),
      candidato('c', 40, 9, 3_000),
      candidato('d', 40, 9, 2_000),
      candidato('e', 12, 3, 500),
    ];
    const atteso = pickWeeklyWinner(candidati)?.userId;
    expect(atteso).toBe('d'); // stessi punti, più esatti, consegnata prima di 'c'

    // Ogni permutazione circolare deve dare lo stesso vincitore.
    for (let i = 0; i < candidati.length; i++) {
      const ruotati = [...candidati.slice(i), ...candidati.slice(0, i)];
      expect(pickWeeklyWinner(ruotati)?.userId).toBe(atteso);
    }
  });

  it('non altera l\'array ricevuto', () => {
    const candidati = [candidato('a', 10), candidato('b', 90)];
    const copia = [...candidati];
    pickWeeklyWinner(candidati);
    expect(candidati).toEqual(copia);
  });
});
