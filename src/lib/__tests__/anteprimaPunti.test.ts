import { describe, expect, it } from 'vitest';
import type { Prediction } from '@/types';
import { POWERUPS } from '../economy';
import {
  BONUS_TUTTI_GIUSTI,
  costoPowerup,
  puntiGiocata,
  puntiPotenziali,
} from '../anteprimaPunti';

const p = (matchId: string, odds: number): Prediction =>
  ({ matchId, betType: 'esito', outcome: '1', odds }) as Prediction;

describe('puntiGiocata', () => {
  it('vale la quota per dieci, con il tetto a 5.00', () => {
    expect(puntiGiocata(2)).toBe(20);
    expect(puntiGiocata(8)).toBe(50);
  });
});

describe('puntiPotenziali', () => {
  it('senza pronostici vale zero', () => {
    expect(puntiPotenziali([], {}, 10)).toBe(0);
  });

  it('somma le quote cappate e aggiunge il bonus solo a schedina completa', () => {
    const due = [p('a', 2), p('b', 9)];
    expect(puntiPotenziali(due, {}, 10)).toBe(70);
    expect(puntiPotenziali(due, {}, 2)).toBe(70 + BONUS_TUTTI_GIUSTI);
  });

  it('il Jolly raddoppia la giocata scelta', () => {
    expect(puntiPotenziali([p('a', 2), p('b', 3)], { jolly: 'b' }, 5)).toBe(80);
  });

  it('lo Scudo toglie la penalita delle quote basse', () => {
    const basse = [p('a', 1.26), p('b', 1.27), p('c', 1.28)];
    const senza = puntiPotenziali(basse, {}, 5);
    const conScudo = puntiPotenziali(basse, { shield: true }, 5);
    expect(conScudo).toBeCloseTo(38.1, 5);
    expect(senza).toBeCloseTo(38.1 * 0.9, 5);
  });
});

describe('costoPowerup', () => {
  it('somma i costi dei power-up scelti', () => {
    expect(costoPowerup(undefined)).toBe(0);
    expect(costoPowerup({ jolly: 'a', shield: true, insurance: true })).toBe(
      POWERUPS.jolly.cost + POWERUPS.shield.cost + POWERUPS.insurance.cost
    );
  });
});
