// Regole pure dei minigiochi (functions/src/minigiochi.ts): tetti giornalieri,
// serie, codice dei duelli, round del duello, sessioni di memoria e quiz.
// Decidono gettoni: interessano i limiti e i casi in cui il client mente.
import { describe, it, expect } from 'vitest';
import {
  premioConTetto,
  contaPerLaSerie,
  generaCodiceDuello,
  ALFABETO_CODICE_DUELLO,
  componiRound,
  verificaDurata,
  valutaMemoria,
  quizScaduto,
  QUIZ_DURATA_MAX_MS,
  MEMORIA_SECONDI_MINIMI,
  type MossaDuello,
} from '../../../functions/src/minigiochi';
import { COINS } from '../../../functions/src/config';

describe('premioConTetto', () => {
  it('paga il premio pieno se il tetto e\' lontano', () => {
    expect(premioConTetto(30, 50, 0)).toBe(30);
  });

  it('taglia il premio al residuo del giorno', () => {
    expect(premioConTetto(30, 50, 35)).toBe(15);
  });

  it('a tetto raggiunto o superato non paga nulla', () => {
    expect(premioConTetto(30, 50, 50)).toBe(0);
    expect(premioConTetto(30, 50, 80)).toBe(0);
  });

  it('non restituisce mai valori negativi o non finiti', () => {
    expect(premioConTetto(-5, 50, 0)).toBe(0);
    expect(premioConTetto(Number.NaN, 50, 0)).toBe(0);
    expect(premioConTetto(10, 50, Number.NaN)).toBe(10);
  });

  it('il tetto delle sfide e\' allineato tra server e client', () => {
    expect(COINS.sfideTettoGiornaliero).toBeGreaterThanOrEqual(COINS.sfidaMaxReward);
  });
});

describe('contaPerLaSerie', () => {
  it('conta solo le partite concluse', () => {
    for (const a of ['quiz_submit', 'wheel_spin', 'rigori_play', 'sfida_play', 'memoria_play']) {
      expect(contaPerLaSerie(a)).toBe(true);
    }
  });

  it('REGRESSIONE: aprire un gioco non vale come giornata giocata', () => {
    for (const a of ['quiz_start', 'sfida_start', 'memoria_start', 'rigori_start', 'boh', '']) {
      expect(contaPerLaSerie(a)).toBe(false);
    }
  });
});

describe('generaCodiceDuello', () => {
  it('sei caratteri, tutti dall\'alfabeto', () => {
    for (let i = 0; i < 300; i++) {
      const c = generaCodiceDuello();
      expect(c).toHaveLength(6);
      for (const ch of c) expect(ALFABETO_CODICE_DUELLO).toContain(ch);
    }
  });

  it('REGRESSIONE: l\'indice si estrae sulla lunghezza dell\'alfabeto (mai "undefined")', () => {
    const massimi: number[] = [];
    const codice = generaCodiceDuello(max => {
      massimi.push(max);
      return max - 1; // estrazione piu' alta possibile
    });
    expect(new Set(massimi)).toEqual(new Set([ALFABETO_CODICE_DUELLO.length]));
    expect(codice).toBe(ALFABETO_CODICE_DUELLO[ALFABETO_CODICE_DUELLO.length - 1].repeat(6));
    expect(codice).not.toContain('undefined');
  });
});

describe('componiRound — stesse regole per p1 e p2', () => {
  const tiro: MossaDuello = { zone: 'TL', power: 88 };
  const tuffo: MossaDuello = { zone: 'BR', power: 0 };
  const casuale = (attacca: boolean): MossaDuello =>
    attacca ? { zone: 'BC', power: 35 } : { zone: 'TC', power: 0 };

  it('chi attacca da\' zona e potenza, chi para solo la zona', () => {
    const r = componiRound(1, tiro, tuffo, casuale);
    expect(r).toEqual({ shot: 'TL', keeper: 'BR', power: 88, p1Choice: 'TL', p2Choice: 'BR' });
  });

  it('SIMMETRIA: scambiando i ruoli l\'esito e\' lo stesso, specchiato', () => {
    const come1 = componiRound(1, tiro, tuffo, casuale);
    const come2 = componiRound(2, tuffo, tiro, casuale);
    expect(come2.shot).toBe(come1.shot);
    expect(come2.keeper).toBe(come1.keeper);
    expect(come2.power).toBe(come1.power);
    expect(come2.p1Choice).toBe(come1.p2Choice);
    expect(come2.p2Choice).toBe(come1.p1Choice);
  });

  it('la potenza dichiarata da chi para non conta', () => {
    const r = componiRound(2, { zone: 'BL', power: 100 }, { zone: 'TR', power: 40 }, casuale);
    expect(r.power).toBe(40);
  });

  it('una mossa mancante la sceglie il caso, con le stesse regole per tutti', () => {
    expect(componiRound(1, null, tuffo, casuale)).toMatchObject({ shot: 'BC', power: 35 });
    expect(componiRound(2, tuffo, null, casuale)).toMatchObject({ shot: 'BC', power: 35 });
    expect(componiRound(1, tiro, null, casuale).keeper).toBe('TC');
    expect(componiRound(2, null, tiro, casuale).keeper).toBe('TC');
  });
});

describe('verificaDurata', () => {
  it('valida dentro i limiti', () => {
    expect(verificaDurata(5000, 1000, 60_000)).toBe('ok');
  });
  it('troppo presto sotto il minimo', () => {
    expect(verificaDurata(500, 1000, 60_000)).toBe('troppo_presto');
  });
  it('scaduta oltre il massimo o con tempi assurdi', () => {
    expect(verificaDurata(61_000, 1000, 60_000)).toBe('scaduta');
    expect(verificaDurata(Number.NaN, 1000, 60_000)).toBe('scaduta');
  });
});

describe('valutaMemoria', () => {
  const [t1, t2, t3] = COINS.memoriaLevelTimes;
  const [m1, m2, m3] = MEMORIA_SECONDI_MINIMI;

  it('rifiuta chi non ha completato nemmeno un livello', () => {
    expect(valutaMemoria(0, 10, 60_000)).toEqual({ ok: false, motivo: 'nessun_livello' });
    expect(valutaMemoria('boh', 10, 60_000)).toEqual({ ok: false, motivo: 'nessun_livello' });
  });

  it('il tempo residuo non supera il tempo dei livelli meno il minimo per giocarli', () => {
    const r = valutaMemoria(3, 99_999, 10 * 60_000);
    expect(r).toEqual({ ok: true, levelsCompleted: 3, timeRemaining: t1 + t2 + t3 - m1 - m2 - m3 });
  });

  it('non accetta piu\' livelli di quelli esistenti', () => {
    const r = valutaMemoria(99, 0, 10 * 60_000);
    expect(r).toMatchObject({ ok: true, levelsCompleted: COINS.memoriaLevelTimes.length });
  });

  it('REGRESSIONE: tre livelli dichiarati dopo un secondo non valgono', () => {
    expect(valutaMemoria(3, 999, 1000)).toEqual({ ok: false, motivo: 'troppo_veloce' });
  });

  it('una partita persa al secondo livello deve aver consumato tutto il suo timer', () => {
    // Livello 1 chiuso in 10 s, livello 2 perso: almeno 10 + t2 secondi.
    const residuo = t1 - 10;
    expect(valutaMemoria(1, residuo, (10 + t2) * 1000)).toMatchObject({ ok: true, levelsCompleted: 1 });
    expect(valutaMemoria(1, residuo, 5 * 1000)).toEqual({ ok: false, motivo: 'troppo_veloce' });
  });

  it('input sporchi non producono NaN', () => {
    const r = valutaMemoria(1, { hack: true }, 10 * 60_000);
    expect(r).toEqual({ ok: true, levelsCompleted: 1, timeRemaining: 0 });
  });
});

describe('quizScaduto', () => {
  it('dentro il tempo massimo le risposte valgono', () => {
    expect(quizScaduto(0, QUIZ_DURATA_MAX_MS)).toBe(false);
  });
  it('oltre il tempo massimo no', () => {
    expect(quizScaduto(0, QUIZ_DURATA_MAX_MS + 1)).toBe(true);
    expect(quizScaduto(Number.NaN, 0)).toBe(true);
  });
  it('il tempo massimo copre dieci domande da quindici secondi', () => {
    expect(QUIZ_DURATA_MAX_MS).toBeGreaterThanOrEqual(COINS.quizMaxQuestions * 15_000);
  });
});
