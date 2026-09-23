// ============================================
// MAI QUOTE FINTE
//
// Fino al 23/09/2026 i mercati che il bookmaker non pubblicava venivano
// riempiti da un motore di calcolo, e in schedina finivano numeri che nessuna
// agenzia aveva mai esposto: le partite della Lazio hanno giocato cinque
// giornate cosi'. Ora si prende solo quello che c'e' davvero, e questi test
// esistono per impedire che un ripiego rientri dalla finestra.
// ============================================

import { describe, it, expect } from 'vitest';
import { extractOddsFromResponse, haQuoteGiocabili } from '../../../functions/src/realOdds';

type Risposta = Parameters<typeof extractOddsFromResponse>[0];

/** Risposta del fornitore, nella forma verificata il 23/09/2026 su Serie A. */
function risposta(mercati: { name: string; odds: Record<string, unknown>[] }[]): Risposta {
  return {
    id: 1,
    home: 'Genoa CFC',
    away: 'ACF Fiorentina',
    status: 'pending',
    bookmakers: { 'Prova IT': mercati.map(m => ({ ...m, updatedAt: '' })) },
  } as unknown as Risposta;
}

const ML = { name: 'ML', odds: [{ home: '3.15', draw: '3.35', away: '2.25' }] };
const DOPPIA = { name: 'Double Chance', odds: [{ '12': '1.30', '1X': '1.62', X2: '1.35' }] };
const BTTS = { name: 'Both Teams To Score', odds: [{ yes: '1.72', no: '2.00' }] };
const TOTALI = {
  name: 'Totals',
  odds: [
    { hdp: 0.5, over: '1.02', under: '9.00' },
    { hdp: 1.5, over: '1.25', under: '3.80' },
    { hdp: 2.5, over: '1.90', under: '1.85' },
    { hdp: 3.5, over: '3.40', under: '1.30' },
  ],
};
const ML_HT = { name: 'ML HT', odds: [{ home: '3.55', draw: '2.05', away: '2.90' }] };
const TOTALI_HT = {
  name: 'Totals HT',
  odds: [
    { hdp: 0.5, over: '1.35', under: '2.70' },
    { hdp: 1.5, over: '2.60', under: '1.45' },
  ],
};

describe('estrazione quote: solo quello che il bookmaker pubblica', () => {
  it('con il solo 1X2 non compare nessun altro mercato', () => {
    const q = extractOddsFromResponse(risposta([ML]), 'Prova IT');
    expect(q).toEqual({ esito: { '1': 3.15, X: 3.35, '2': 2.25 } });
    expect(q?.over_under).toBeUndefined();
    expect(q?.goal_nogoal).toBeUndefined();
    expect(q?.doppia_chance).toBeUndefined();
    expect(q?.multigoal).toBeUndefined();
  });

  it('le quote sono quelle del bookmaker, non ricalcolate', () => {
    const q = extractOddsFromResponse(risposta([ML, DOPPIA, TOTALI, BTTS]), 'Prova IT');
    expect(q?.esito).toEqual({ '1': 3.15, X: 3.35, '2': 2.25 });
    // La doppia chance arriva dal suo mercato: prima veniva derivata dall'1X2
    // e non coincideva con quella esposta dall'agenzia.
    expect(q?.doppia_chance).toEqual({ '1X': 1.62, '12': 1.3, X2: 1.35 });
    expect(q?.over_under).toEqual({ OVER: 1.9, UNDER: 1.85 });
    expect(q?.goal_nogoal).toEqual({ GG: 1.72, NG: 2 });
  });

  it('il multigoal esce dalle linee vere dell over/under', () => {
    const q = extractOddsFromResponse(risposta([ML, TOTALI]), 'Prova IT');
    expect(q?.multigoal).toEqual({
      'O0.5': 1.02, 'U0.5': 9,
      'O1.5': 1.25, 'U1.5': 3.8,
      'O2.5': 1.9, 'U2.5': 1.85,
      'O3.5': 3.4, 'U3.5': 1.3,
    });
  });

  it('con linee incomplete il multigoal non si offre a meta', () => {
    const parziale = { name: 'Totals', odds: [{ hdp: 2.5, over: '1.90', under: '1.85' }] };
    const q = extractOddsFromResponse(risposta([ML, parziale]), 'Prova IT');
    expect(q?.over_under).toEqual({ OVER: 1.9, UNDER: 1.85 });
    expect(q?.multigoal).toBeUndefined();
  });

  it('i mercati di primo tempo compaiono solo se il bookmaker li ha', () => {
    const senza = extractOddsFromResponse(risposta([ML, TOTALI, BTTS]), 'Prova IT');
    expect(senza?.esito_1t).toBeUndefined();
    expect(senza?.over_under_1t).toBeUndefined();

    const con = extractOddsFromResponse(risposta([ML, ML_HT, TOTALI_HT]), 'Prova IT');
    expect(con?.esito_1t).toEqual({ '1': 3.55, X: 2.05, '2': 2.9 });
    expect(con?.over_under_1t).toEqual({ OVER: 2.6, UNDER: 1.45 });
  });

  it('il GG/NG di primo tempo non esiste per nessun bookmaker', () => {
    const q = extractOddsFromResponse(risposta([ML, DOPPIA, TOTALI, BTTS, ML_HT, TOTALI_HT]), 'Prova IT');
    expect(q?.goal_nogoal_1t).toBeUndefined();
  });

  it('un bookmaker assente nella risposta non produce quote', () => {
    expect(extractOddsFromResponse(risposta([ML]), 'Altra IT')).toBeNull();
  });

  it('valori non numerici non diventano quote', () => {
    const sporco = { name: 'ML', odds: [{ home: 'n/d', draw: '', away: '2.25' }] };
    const q = extractOddsFromResponse(risposta([sporco]), 'Prova IT');
    expect(q?.esito).toBeUndefined();
  });
});

describe('haQuoteGiocabili', () => {
  it('una partita e giocabile solo con l 1X2', () => {
    expect(haQuoteGiocabili({ esito: { '1': 2, X: 3, '2': 4 } })).toBe(true);
    expect(haQuoteGiocabili({ goal_nogoal: { GG: 1.7, NG: 2 } })).toBe(false);
    expect(haQuoteGiocabili({})).toBe(false);
    expect(haQuoteGiocabili(undefined)).toBe(false);
  });
});
