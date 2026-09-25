// Le regole con cui la sincronizzazione tiene le quote della giornata. Con il
// merge profondo di Firestore le partite tolte e le agenzie non piu' usate
// restavano nel documento per sempre; e ogni tentazione di "riempire" una
// quota mancante con un'altra agenzia o con un calcolo e' una quota finta.
import { describe, it, expect } from 'vitest';
import {
  applicaAggiornamento,
  contaQuotate,
  partitaIniziata,
  partitaQuotabile,
  slugFornitore,
  statoDaSync,
  unisciQuote,
} from '../../../functions/src/palinsesto';
import type { MatchOdds } from '../../../functions/src/odds';

const q = (uno: number): MatchOdds => ({ esito: { '1': uno, X: 3.2, '2': 3.8 } });

describe('unisciQuote', () => {
  it('le partite cominciate restano ferme: ne ritoccate ne tolte', () => {
    const out = unisciQuote({ a: q(2) }, { a: q(9) }, ['a'], {
      partite: ['a'],
      verificate: ['a'],
      riquota: true,
    });
    expect(out.a).toEqual(q(2));

    const ritirata = unisciQuote({ a: q(2) }, {}, ['a'], { partite: ['a'], verificate: ['a'] });
    expect(ritirata.a).toEqual(q(2));
  });

  it('una partita cominciata senza quote non le prende adesso', () => {
    const out = unisciQuote({}, { a: q(2) }, ['a'], { partite: ['a'], verificate: ['a'] });
    expect(out).toEqual({});
  });

  it('una partita da giocare ritirata dal fornitore esce', () => {
    const out = unisciQuote({ a: q(2), b: q(3) }, { b: q(3) }, [], {
      partite: ['a', 'b'],
      verificate: ['a', 'b'],
    });
    expect(out).toEqual({ b: q(3) });
  });

  it('senza risposta certa dal fornitore si tiene quello che c era', () => {
    const out = unisciQuote({ a: q(2) }, {}, [], { partite: ['a'], verificate: [] });
    expect(out).toEqual({ a: q(2) });
  });

  it('le quote pubblicate restano quelle, salvo riquota', () => {
    const tenute = unisciQuote({ a: q(2) }, { a: q(2.5) }, [], { partite: ['a'], verificate: ['a'] });
    expect(tenute.a).toEqual(q(2));
    const riquotate = unisciQuote({ a: q(2) }, { a: q(2.5) }, [], {
      partite: ['a'],
      verificate: ['a'],
      riquota: true,
    });
    expect(riquotate.a).toEqual(q(2.5));
  });

  it('una partita rimasta senza quote si recupera al giro dopo', () => {
    const primo = unisciQuote({}, {}, [], { partite: ['a'], verificate: ['a'] });
    expect(primo).toEqual({});
    const secondo = unisciQuote(primo, { a: q(2) }, [], { partite: ['a'], verificate: ['a'] });
    expect(secondo.a).toEqual(q(2));
  });

  it('le chiavi fuori dalla giornata spariscono', () => {
    const out = unisciQuote({ vecchia: q(2), a: q(3) }, { altra: q(4) }, ['vecchia'], {
      partite: ['a'],
      verificate: [],
    });
    expect(Object.keys(out)).toEqual(['a']);
  });

  it('una quota senza 1X2 non conta come quotata', () => {
    const out = unisciQuote({}, { a: { over_under: { OVER: 1.9, UNDER: 1.9 } } }, [], {
      partite: ['a'],
      verificate: ['a'],
    });
    expect(out).toEqual({});
  });

  it('non inventa nulla: senza prev e senza nuove resta vuota', () => {
    expect(unisciQuote(undefined, undefined, [], { partite: ['a', 'b'], verificate: [] })).toEqual({});
  });
});

describe('stato delle partite', () => {
  const ora = Date.UTC(2026, 8, 27, 12);
  it('iniziata: live, finita, sospesa in corso, o fischio passato', () => {
    expect(partitaIniziata('live', ora + 1, ora)).toBe(true);
    expect(partitaIniziata('finished', ora + 1, ora)).toBe(true);
    expect(partitaIniziata('abandoned', ora + 1, ora)).toBe(true);
    expect(partitaIniziata('scheduled', ora, ora)).toBe(true);
    expect(partitaIniziata('scheduled', ora + 1, ora)).toBe(false);
    expect(partitaIniziata('postponed', ora - 1, ora)).toBe(false);
    expect(partitaIniziata('canceled', ora - 1, ora)).toBe(false);
  });

  it('si quota solo una partita da giocare nel futuro', () => {
    expect(partitaQuotabile('scheduled', ora + 1, ora)).toBe(true);
    expect(partitaQuotabile('scheduled', ora, ora)).toBe(false);
    expect(partitaQuotabile('live', ora + 1, ora)).toBe(false);
    expect(partitaQuotabile('postponed', ora + 1, ora)).toBe(false);
  });

  it('la sync registra rinvii e riprogrammazioni, non l andamento in campo', () => {
    expect(statoDaSync('scheduled', 'postponed', false)).toBe('postponed');
    expect(statoDaSync('scheduled', 'canceled', true)).toBe('canceled');
    expect(statoDaSync('live', 'abandoned', true)).toBe('abandoned');
    expect(statoDaSync('postponed', 'scheduled', false)).toBe('scheduled');
    expect(statoDaSync('scheduled', 'live', false)).toBe('scheduled');
    expect(statoDaSync('scheduled', 'finished', true)).toBe('scheduled');
    expect(statoDaSync('scheduled', undefined, false)).toBe('scheduled');
  });

  it('dopo la deadline un rinvio resta tale', () => {
    expect(statoDaSync('postponed', 'scheduled', true)).toBe('postponed');
  });

  it('una partita finita non cambia piu', () => {
    expect(statoDaSync('finished', 'postponed', true)).toBe('finished');
  });
});

describe('applicaAggiornamento', () => {
  it('una partita chiusa non torna live', () => {
    const m = { id: 'a', status: 'finished', result: { homeGoals: 2, awayGoals: 1, outcome: '1' as const } };
    expect(
      applicaAggiornamento(m, { status: 'live', result: { homeGoals: 1, awayGoals: 1, outcome: 'X' } })
    ).toBe(m);
  });

  it('il parziale gia salvato non si perde', () => {
    const m = {
      id: 'a',
      status: 'live',
      result: { homeGoals: 1, awayGoals: 0, outcome: '1' as const, htHomeGoals: 1, htAwayGoals: 0 },
    };
    const out = applicaAggiornamento(m, {
      status: 'finished',
      result: { homeGoals: 2, awayGoals: 0, outcome: '1' },
    });
    expect(out.result).toEqual({ homeGoals: 2, awayGoals: 0, outcome: '1', htHomeGoals: 1, htAwayGoals: 0 });
    expect(out.status).toBe('finished');
  });

  it('un rinvio cambia lo stato senza toccare il resto', () => {
    const m = { id: 'a', status: 'scheduled', extra: 1 };
    expect(applicaAggiornamento(m, { status: 'postponed' })).toEqual({ id: 'a', status: 'postponed', extra: 1 });
  });
});

describe('contaQuotate e slug del fornitore', () => {
  it('conta solo le partite della giornata con 1X2', () => {
    const odds = { a: q(2), b: {}, fuori: q(3) } as Record<string, MatchOdds>;
    expect(contaQuotate(odds, ['a', 'b', 'c'])).toBe(1);
    expect(contaQuotate(undefined, ['a'])).toBe(0);
  });

  it('i campionati senza slug non sono quotabili', () => {
    expect(slugFornitore('ita.1')).toBe('italy-serie-a');
    expect(slugFornitore('uefa.champions')).toBeUndefined();
  });
});
