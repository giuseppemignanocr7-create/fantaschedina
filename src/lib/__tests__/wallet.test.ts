import { describe, expect, it } from 'vitest';
import { etichettaCausale } from '../wallet';

// Le causali sono stringhe tecniche scritte dal server: l'utente deve
// leggere "Power-up giornata 3", non "powerups_g3". Una causale nuova
// che nessuno ha ancora tradotto non deve rompere la lista.
describe('etichettaCausale', () => {
  it('traduce le causali con la giornata', () => {
    expect(etichettaCausale('settlement_g3')).toBe('Punti della giornata 3');
    expect(etichettaCausale('powerups_g12')).toBe('Power-up giornata 12');
    expect(etichettaCausale('powerups_refund_g12')).toBe('Rimborso power-up giornata 12');
    expect(etichettaCausale('powerups_refund_cancel_g4')).toBe('Rimborso power-up giornata 4');
    expect(etichettaCausale('powerup_lastminute_g7')).toBe('Cambio last-minute giornata 7');
    expect(etichettaCausale('raffle_g5')).toBe('Biglietti estrazione giornata 5');
  });

  it('traduce minigiochi, missioni e duelli', () => {
    expect(etichettaCausale('minigame_quiz')).toBe('Quiz calcio');
    expect(etichettaCausale('minigame_sfida')).toBe('Sfida 1vs1');
    expect(etichettaCausale('penalty_duel_win')).toBe('Duello vinto');
    expect(etichettaCausale('penalty_duel_draw')).toBe('Duello: pareggio');
    expect(etichettaCausale('mission_first_schedina')).toBe('Missione completata');
  });

  it('una causale sconosciuta resta leggibile', () => {
    expect(etichettaCausale('qualcosa_di_nuovo')).toBe('qualcosa di nuovo');
    expect(etichettaCausale('')).toBe('');
  });
});
