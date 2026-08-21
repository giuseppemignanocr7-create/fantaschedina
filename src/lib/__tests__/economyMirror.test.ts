// ============================================
// ALLINEAMENTO ECONOMIA CLIENT ↔ SERVER
//
// `src/lib/economy.ts` è una copia manuale di `functions/src/config.ts`: il
// client non può importare dal codice delle functions (dipendenze diverse,
// non installate su Vercel). Finora nessun test confrontava le due copie, e
// una divergenza si sarebbe vista solo in produzione — come un prezzo mostrato
// nella UI diverso da quello addebitato dal server.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  COINS as CLIENT_COINS,
  POWERUPS as CLIENT_POWERUPS,
  MISSIONS as CLIENT_MISSIONS,
  MAX_PICKS_PER_SCHEDINA as CLIENT_MAX_PICKS,
} from '../economy';
import {
  COINS as SERVER_COINS,
  POWERUPS as SERVER_POWERUPS,
  MISSIONS as SERVER_MISSIONS,
  MAX_PICKS_PER_SCHEDINA as SERVER_MAX_PICKS,
} from '../../../functions/src/config';

describe('COINS — il mirror client riflette il server', () => {
  const chiaviServer = Object.keys(SERVER_COINS) as (keyof typeof SERVER_COINS)[];

  it('il client non dimentica nessun parametro del server', () => {
    expect(Object.keys(CLIENT_COINS).sort()).toEqual(chiaviServer.slice().sort());
  });

  it.each(chiaviServer.map(k => ({ k })))('$k ha lo stesso valore', ({ k }) => {
    expect(CLIENT_COINS[k as keyof typeof CLIENT_COINS]).toEqual(SERVER_COINS[k]);
  });
});

describe('POWERUPS — prezzi identici', () => {
  it('stessi power-up in catalogo', () => {
    expect(Object.keys(CLIENT_POWERUPS).sort()).toEqual(Object.keys(SERVER_POWERUPS).sort());
  });

  it.each(Object.keys(SERVER_POWERUPS).map(id => ({ id })))(
    '$id costa uguale da entrambe le parti',
    ({ id }) => {
      const client = CLIENT_POWERUPS[id as keyof typeof CLIENT_POWERUPS];
      const server = SERVER_POWERUPS[id as keyof typeof SERVER_POWERUPS];
      expect(client.cost).toBe(server.cost);
      expect(client.id).toBe(server.id);
    }
  );
});

describe('MISSIONS — stessi obiettivi e stessi premi', () => {
  it('stesso numero di missioni', () => {
    expect(CLIENT_MISSIONS).toHaveLength(SERVER_MISSIONS.length);
  });

  it.each(SERVER_MISSIONS.map(m => ({ id: m.id })))('$id: target e premio uguali', ({ id }) => {
    const client = CLIENT_MISSIONS.find(m => m.id === id);
    const server = SERVER_MISSIONS.find(m => m.id === id);
    expect(client).toBeDefined();
    expect(client?.target).toBe(server?.target);
    expect(client?.reward).toBe(server?.reward);
    expect(client?.field).toBe(server?.field);
  });
});

describe('Regole di schedina', () => {
  it('lo stesso numero di pronostici per schedina', () => {
    expect(CLIENT_MAX_PICKS).toBe(SERVER_MAX_PICKS);
  });
});
