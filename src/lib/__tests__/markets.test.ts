import { describe, it, expect } from 'vitest';
import { BET_TYPE_LABEL, BET_TYPE_SHORT, betLabel, outcomeLabel } from '../markets';

// Queste etichette sono l'unica cosa che l'utente legge quando riguarda una
// schedina già inviata: se sbagliano, uno vede scritto un pronostico diverso da
// quello che ha giocato. La pagina di una lega e quella dei pronostici devono
// dire le stesse parole, per questo stanno in un modulo solo.

describe('outcomeLabel — esiti scritti come li legge un giocatore', () => {
  it('over/under finale espone la linea 2.5', () => {
    expect(outcomeLabel('over_under', 'OVER')).toBe('Over 2.5');
    expect(outcomeLabel('over_under', 'UNDER')).toBe('Under 2.5');
  });

  it('over/under primo tempo espone la linea 1.5, non la 2.5', () => {
    expect(outcomeLabel('over_under_1t', 'OVER')).toBe('Over 1.5');
    expect(outcomeLabel('over_under_1t', 'UNDER')).toBe('Under 1.5');
  });

  it('goal/nogoal si legge per esteso, in entrambi i tempi', () => {
    expect(outcomeLabel('goal_nogoal', 'GG')).toBe('Goal Goal');
    expect(outcomeLabel('goal_nogoal', 'NG')).toBe('No Goal');
    expect(outcomeLabel('goal_nogoal_1t', 'GG')).toBe('Goal Goal');
    expect(outcomeLabel('goal_nogoal_1t', 'NG')).toBe('No Goal');
  });

  it('multigoal porta la sua linea, che cambia da giocata a giocata', () => {
    expect(outcomeLabel('multigoal', 'O0.5')).toBe('Over 0.5');
    expect(outcomeLabel('multigoal', 'U1.5')).toBe('Under 1.5');
    expect(outcomeLabel('multigoal', 'O3.5')).toBe('Over 3.5');
  });

  it('esito e doppia chance restano il simbolo giocato', () => {
    expect(outcomeLabel('esito', '1')).toBe('1');
    expect(outcomeLabel('esito', 'X')).toBe('X');
    expect(outcomeLabel('esito_1t', '2')).toBe('2');
    expect(outcomeLabel('doppia_chance', '1X')).toBe('1X');
    expect(outcomeLabel('doppia_chance', 'X2')).toBe('X2');
  });

  it('un mercato sconosciuto non inventa nulla: restituisce l’esito grezzo', () => {
    expect(outcomeLabel('mercato_mai_visto', 'QUALCOSA')).toBe('QUALCOSA');
  });
});

describe('betLabel — mercato ed esito in una riga sola', () => {
  it('unisce nome breve del mercato ed esito leggibile', () => {
    expect(betLabel('esito', '1')).toBe('1X2 · 1');
    expect(betLabel('over_under', 'OVER')).toBe('O/U · Over 2.5');
    expect(betLabel('goal_nogoal_1t', 'NG')).toBe('GG 1T · No Goal');
    expect(betLabel('multigoal', 'U2.5')).toBe('MG · Under 2.5');
  });

  it('di un mercato sconosciuto mostra la chiave, non una riga vuota', () => {
    expect(betLabel('mercato_mai_visto', 'X')).toBe('mercato_mai_visto · X');
  });
});

describe('tabelle dei mercati', () => {
  const MERCATI = [
    'esito',
    'over_under',
    'goal_nogoal',
    'doppia_chance',
    'multigoal',
    'esito_1t',
    'over_under_1t',
    'goal_nogoal_1t',
  ];

  it('ogni mercato giocabile ha sia il nome breve sia quello esteso', () => {
    for (const m of MERCATI) {
      expect(BET_TYPE_SHORT[m], `manca il nome breve di ${m}`).toBeTruthy();
      expect(BET_TYPE_LABEL[m], `manca il nome esteso di ${m}`).toBeTruthy();
    }
  });

  it('i nomi brevi sono distinti: due mercati diversi non si confondono', () => {
    const brevi = MERCATI.map(m => BET_TYPE_SHORT[m]);
    expect(new Set(brevi).size).toBe(MERCATI.length);
  });

  it('i mercati di primo tempo si distinguono da quelli finali', () => {
    expect(BET_TYPE_SHORT.esito_1t).not.toBe(BET_TYPE_SHORT.esito);
    expect(BET_TYPE_SHORT.over_under_1t).not.toBe(BET_TYPE_SHORT.over_under);
    expect(BET_TYPE_SHORT.goal_nogoal_1t).not.toBe(BET_TYPE_SHORT.goal_nogoal);
  });
});
