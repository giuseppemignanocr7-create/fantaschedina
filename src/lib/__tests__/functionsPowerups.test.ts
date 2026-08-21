// Test della contabilità power-up server-side (functions/src/powerups.ts).
//
// Regressione principale: fino al 20/08/2026 `submitSchedina` accreditava il
// rimborso pieno dei power-up precedenti ma addebitava solo la differenza,
// così ogni modifica della schedina regalava `2×refund − cost` gettoni.
// Con gli stessi power-up l'utente incassava l'intero costo a ogni reinvio.
import { describe, it, expect } from 'vitest';
import {
  powerupCost,
  computePowerupCharge,
  isLastMinuteWindowOpen,
} from '../../../functions/src/powerups';
import { POWERUPS, type PowerUpSelection } from '../../../functions/src/config';

const JOLLY = POWERUPS.jolly.cost;
const SHIELD = POWERUPS.shield.cost;
const INSURANCE = POWERUPS.insurance.cost;

const all: PowerUpSelection = { jolly: 'm1', shield: true, insurance: true };

/** Applica un (re)invio a un saldo, come fa la transazione di submitSchedina. */
function applyToBalance(
  balance: number,
  previous: PowerUpSelection | undefined,
  next: PowerUpSelection | undefined
): number {
  const { refund, charge } = computePowerupCharge(previous, next);
  return balance + refund - charge;
}

describe('powerupCost — costo di una selezione', () => {
  it('nessun power-up non costa nulla', () => {
    expect(powerupCost({})).toBe(0);
    expect(powerupCost(undefined)).toBe(0);
  });
  it('somma i power-up selezionati', () => {
    expect(powerupCost({ jolly: 'm1' })).toBe(JOLLY);
    expect(powerupCost({ shield: true })).toBe(SHIELD);
    expect(powerupCost({ insurance: true })).toBe(INSURANCE);
    expect(powerupCost(all)).toBe(JOLLY + SHIELD + INSURANCE);
  });
  it('il jolly conta per il matchId, non per un booleano', () => {
    expect(powerupCost({ jolly: '' } as PowerUpSelection)).toBe(0);
  });
});

describe('computePowerupCharge — primo invio', () => {
  it('addebita il costo pieno, nessun rimborso', () => {
    expect(computePowerupCharge(undefined, all)).toEqual({
      refund: 0,
      charge: JOLLY + SHIELD + INSURANCE,
      net: -(JOLLY + SHIELD + INSURANCE),
    });
  });
  it('schedina senza power-up: nessun movimento', () => {
    expect(computePowerupCharge(undefined, {})).toEqual({ refund: 0, charge: 0, net: 0 });
  });
});

describe('computePowerupCharge — REGRESSIONE: reinvio senza modifiche', () => {
  it('stessi power-up ⇒ saldo invariato (non +costo)', () => {
    const { refund, charge, net } = computePowerupCharge(all, all);
    expect(refund).toBe(JOLLY + SHIELD + INSURANCE);
    expect(charge).toBe(JOLLY + SHIELD + INSURANCE);
    expect(net).toBe(0);
  });

  it.each([
    ['solo jolly', { jolly: 'm1' } as PowerUpSelection],
    ['solo scudo', { shield: true } as PowerUpSelection],
    ['tutti e tre', all],
  ])('%s: 50 reinvii consecutivi non creano gettoni', (_label, selection) => {
    const iniziale = 1000;
    let saldo = applyToBalance(iniziale, undefined, selection);
    expect(saldo).toBe(iniziale - powerupCost(selection));

    for (let i = 0; i < 50; i++) {
      saldo = applyToBalance(saldo, selection, selection);
    }
    expect(saldo).toBe(iniziale - powerupCost(selection));
  });
});

describe('computePowerupCharge — modifiche della selezione', () => {
  it('rimuovere tutti i power-up restituisce esattamente quanto speso', () => {
    const iniziale = 1000;
    const dopoInvio = applyToBalance(iniziale, undefined, all);
    expect(applyToBalance(dopoInvio, all, {})).toBe(iniziale);
  });

  it('upgrade scudo → jolly: paga la differenza, non meno', () => {
    const { refund, charge, net } = computePowerupCharge({ shield: true }, { jolly: 'm1' });
    expect(refund).toBe(SHIELD);
    expect(charge).toBe(JOLLY);
    expect(net).toBe(SHIELD - JOLLY);
  });

  it('downgrade jolly → scudo: rimborsa la differenza, non di più', () => {
    expect(computePowerupCharge({ jolly: 'm1' }, { shield: true }).net).toBe(JOLLY - SHIELD);
  });

  it('cambiare la partita del jolly non costa nulla', () => {
    expect(computePowerupCharge({ jolly: 'm1' }, { jolly: 'm7' }).net).toBe(0);
  });

  it('aggiungere un power-up costa solo quello aggiunto', () => {
    expect(computePowerupCharge({ jolly: 'm1' }, { jolly: 'm1', shield: true }).net).toBe(-SHIELD);
  });
});

describe('computePowerupCharge — registro movimenti', () => {
  it('rimborso e addebito restano interi e separati (audit trail leggibile)', () => {
    const { refund, charge } = computePowerupCharge({ shield: true }, all);
    expect(refund).toBe(SHIELD);
    expect(charge).toBe(JOLLY + SHIELD + INSURANCE);
  });

  it('net è sempre refund − charge', () => {
    const casi: [PowerUpSelection | undefined, PowerUpSelection | undefined][] = [
      [undefined, all],
      [all, undefined],
      [{ shield: true }, { insurance: true }],
      [{}, {}],
    ];
    for (const [prev, next] of casi) {
      const r = computePowerupCharge(prev, next);
      expect(r.net).toBe(r.refund - r.charge);
    }
  });
});

describe('isLastMinuteWindowOpen — finestra del Cambio Last-Minute', () => {
  const DEADLINE = 1_000_000;
  const base = { deadline: DEADLINE, matchStatus: 'scheduled', matchKickoff: DEADLINE + 60_000 };

  it('chiusa prima della deadline: lì la schedina si rimanda gratis', () => {
    expect(isLastMinuteWindowOpen({ ...base, now: DEADLINE - 1 })).toBe(false);
  });
  it('aperta esattamente alla deadline', () => {
    expect(isLastMinuteWindowOpen({ ...base, now: DEADLINE })).toBe(true);
  });
  it('aperta tra deadline e fischio d\'inizio', () => {
    expect(isLastMinuteWindowOpen({ ...base, now: DEADLINE + 30_000 })).toBe(true);
  });
  it('chiusa al fischio d\'inizio', () => {
    expect(isLastMinuteWindowOpen({ ...base, now: base.matchKickoff })).toBe(false);
  });
  it('chiusa a partita iniziata', () => {
    expect(isLastMinuteWindowOpen({ ...base, now: base.matchKickoff + 1 })).toBe(false);
  });
  it.each(['live', 'finished', 'postponed'])(
    'chiusa se la partita è %s, anche prima del kickoff previsto',
    status => {
      expect(
        isLastMinuteWindowOpen({ ...base, matchStatus: status, now: DEADLINE + 1 })
      ).toBe(false);
    }
  );
});
