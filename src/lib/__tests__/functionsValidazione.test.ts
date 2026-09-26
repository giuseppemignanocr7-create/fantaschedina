// Validazione server-side dei pronostici (functions/src/validazione.ts) e
// conteggio dei pronostici richiesti, lato server e lato client.
import { describe, it, expect } from 'vitest';
import {
  partitaNonIniziata,
  quotaUfficiale,
  validaPronostici,
  type PartitaGiocabile,
} from '../../../functions/src/validazione';
import { pickRichieste as pickRichiesteServer } from '../../../functions/src/config';
import type { MatchOdds } from '../../../functions/src/odds';
import { pickRichieste as pickRichiesteClient } from '../pickRichieste';

const ORA = Date.UTC(2026, 8, 25, 12);

function quote(): MatchOdds {
  return {
    esito: { '1': 2.0, X: 3.2, '2': 3.8 },
    over_under: { OVER: 1.9, UNDER: 1.9 },
    doppia_chance: { '1X': 1.3, '12': 1.25, X2: 1.7 },
    multigoal: { 'O0.5': 1.1, 'U0.5': 6.0, 'O2.5': 2.1, 'U2.5': 1.7 },
  };
}

function giornata(n = 10): { partite: PartitaGiocabile[]; quote: Record<string, MatchOdds> } {
  const partite = Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    status: 'scheduled',
    kickoffMs: ORA + 3 * 60 * 60 * 1000,
  }));
  const q: Record<string, MatchOdds> = {};
  for (const p of partite) q[p.id] = quote();
  return { partite, quote: q };
}

function dieci(outcome = '1'): Record<string, unknown>[] {
  return Array.from({ length: 10 }, (_, i) => ({
    matchId: `m${i}`,
    betType: 'esito',
    outcome,
    odds: 99,
  }));
}

describe('quotaUfficiale', () => {
  const q = giornata().quote;

  it('restituisce la quota del bookmaker, non quella del client', () => {
    expect(quotaUfficiale(q, 'm0', 'esito', '1')).toEqual({ ok: true, valore: 2.0 });
    expect(quotaUfficiale(q, 'm0', 'multigoal', 'O2.5')).toEqual({ ok: true, valore: 2.1 });
  });

  it.each([
    ['constructor', 'name'],
    ['__proto__', '1'],
    ['esito', '__proto__'],
    ['esito', 'constructor'],
    ['esito', 'toString'],
    ['esito', 'hasOwnProperty'],
    ['inventato', '1'],
    ['goal_nogoal', 'GG'], // mercato noto ma non quotato per questa partita
    ['esito', 'Z'],
  ])('rifiuta %s/%s', (betType, outcome) => {
    expect(quotaUfficiale(q, 'm0', betType, outcome).ok).toBe(false);
  });

  it('rifiuta partite senza quote e partite pescate dal prototipo', () => {
    expect(quotaUfficiale(q, 'mX', 'esito', '1').ok).toBe(false);
    expect(quotaUfficiale(q, '__proto__', 'esito', '1').ok).toBe(false);
    expect(quotaUfficiale(q, 'constructor', 'esito', '1').ok).toBe(false);
  });

  it('rifiuta valori non stringa', () => {
    expect(quotaUfficiale(q, 1, 'esito', '1').ok).toBe(false);
    expect(quotaUfficiale(q, 'm0', ['esito'], '1').ok).toBe(false);
    expect(quotaUfficiale(q, 'm0', 'esito', 1).ok).toBe(false);
    expect(quotaUfficiale(q, 'm0', 'esito', null).ok).toBe(false);
  });

  it('rifiuta quote sotto 1.25 con un messaggio chiaro, accetta 1.25', () => {
    const bassa = quotaUfficiale(q, 'm0', 'multigoal', 'O0.5');
    expect(bassa.ok).toBe(false);
    if (!bassa.ok) expect(bassa.messaggio).toContain('1.25');
    expect(quotaUfficiale(q, 'm0', 'doppia_chance', '12')).toEqual({ ok: true, valore: 1.25 });
  });

  it('rifiuta quote non numeriche, infinite o non superiori a 1', () => {
    const rotte: Record<string, MatchOdds> = {
      a: { esito: { '1': Number.NaN, X: Infinity, '2': 1 } },
      b: { esito: '2.0' as unknown as MatchOdds['esito'] },
      c: { multigoal: { Oabc: 2 } },
    };
    expect(quotaUfficiale(rotte, 'a', 'esito', '1').ok).toBe(false);
    expect(quotaUfficiale(rotte, 'a', 'esito', 'X').ok).toBe(false);
    expect(quotaUfficiale(rotte, 'a', 'esito', '2').ok).toBe(false);
    expect(quotaUfficiale(rotte, 'b', 'esito', '1').ok).toBe(false);
    // Linea multigoal illeggibile: evaluateBet la annullerebbe.
    expect(quotaUfficiale(rotte, 'c', 'multigoal', 'Oabc').ok).toBe(false);
  });
});

describe('validaPronostici', () => {
  const ctx = (richieste = 10, n = 10) => ({ ...giornata(n), richieste, nowMs: ORA });

  it('pulisce i pronostici e mette le quote ufficiali', () => {
    const r = validaPronostici(
      dieci().map(p => ({ ...p, extra: 'x' })),
      ctx()
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valore).toHaveLength(10);
      expect(r.valore[0]).toEqual({ matchId: 'm0', betType: 'esito', outcome: '1', odds: 2.0 });
    }
  });

  it('rifiuta input che non sono una lista di pronostici', () => {
    expect(validaPronostici(undefined, ctx()).ok).toBe(false);
    expect(validaPronostici([], ctx()).ok).toBe(false);
    expect(validaPronostici('m0', ctx()).ok).toBe(false);
    const conNull = dieci();
    conNull[0] = null as unknown as Record<string, unknown>;
    expect(validaPronostici(conNull, ctx()).ok).toBe(false);
  });

  it('esattamente i pronostici richiesti', () => {
    const r = validaPronostici(dieci().slice(0, 9), ctx());
    expect(r).toMatchObject({ ok: false, codice: 'invalid-argument' });
    if (!r.ok) expect(r.messaggio).toContain('10');
    expect(validaPronostici(dieci().slice(0, 8), ctx(8)).ok).toBe(true);
  });

  it('nessuna partita quotata: niente schedina', () => {
    expect(validaPronostici(dieci(), ctx(0))).toMatchObject({
      ok: false,
      codice: 'failed-precondition',
    });
  });

  it('una partita sola volta, e solo della giornata', () => {
    const doppione = dieci();
    doppione[1] = { ...doppione[1], matchId: 'm0' };
    expect(validaPronostici(doppione, ctx()).ok).toBe(false);

    const fuori = dieci();
    fuori[0] = { ...fuori[0], matchId: 'altra' };
    expect(validaPronostici(fuori, ctx()).ok).toBe(false);

    const numerico = dieci();
    numerico[0] = { ...numerico[0], matchId: 7 };
    expect(validaPronostici(numerico, ctx()).ok).toBe(false);
  });

  it('partita gia\' iniziata o non piu\' programmata: rifiutata', () => {
    const c = ctx();
    c.partite[0] = { ...c.partite[0], status: 'live' };
    expect(validaPronostici(dieci(), c)).toMatchObject({ ok: false, codice: 'failed-precondition' });

    const c2 = ctx();
    c2.partite[0] = { ...c2.partite[0], kickoffMs: ORA - 1000 };
    expect(validaPronostici(dieci(), c2)).toMatchObject({ ok: false, codice: 'failed-precondition' });
  });

  it('propaga il rifiuto di un mercato truccato', () => {
    const truccato = dieci();
    truccato[3] = { ...truccato[3], betType: 'esito', outcome: '__proto__' };
    expect(validaPronostici(truccato, ctx())).toMatchObject({ ok: false, codice: 'invalid-argument' });
  });
});

describe('partitaNonIniziata', () => {
  it('solo programmata e con il fischio nel futuro', () => {
    expect(partitaNonIniziata({ id: 'a', status: 'scheduled', kickoffMs: ORA + 1 }, ORA)).toBe(true);
    expect(partitaNonIniziata({ id: 'a', status: 'pre', kickoffMs: ORA + 1 }, ORA)).toBe(true);
    expect(partitaNonIniziata({ id: 'a', status: 'scheduled', kickoffMs: ORA }, ORA)).toBe(false);
    expect(partitaNonIniziata({ id: 'a', status: 'postponed', kickoffMs: ORA + 1 }, ORA)).toBe(false);
    expect(partitaNonIniziata({ id: 'a', status: 'finished', kickoffMs: ORA + 1 }, ORA)).toBe(false);
  });
});

describe('pickRichieste', () => {
  it.each([
    ['server', pickRichiesteServer],
    ['client', pickRichiesteClient as unknown as typeof pickRichiesteServer],
  ])('%s: dieci al massimo, meno se sono quotate meno partite', (_, pick) => {
    expect(pick(giornata(12).quote)).toBe(10);
    expect(pick(giornata(10).quote)).toBe(10);
    expect(pick(giornata(7).quote)).toBe(7);
    expect(pick({})).toBe(0);
    expect(pick(undefined)).toBe(0);
    // Conta solo le partite con l'esito finale quotato.
    const senzaEsito = giornata(10).quote;
    delete senzaEsito.m0.esito;
    delete senzaEsito.m1.esito;
    expect(pick(senzaEsito)).toBe(8);
  });
});
