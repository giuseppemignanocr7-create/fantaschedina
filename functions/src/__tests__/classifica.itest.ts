// ============================================
// TEST DI INTEGRAZIONE — CLASSIFICA
// La callable `getRankings` ha sostituito lo scarico di tutti i profili da
// parte di ogni client. Qui si verifica che ordini davvero, che escluda chi
// non deve comparire e che la variante per lega rispetti la privacy.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest';
import { getRankings } from '../index';
import { db, seedProfile, wipe } from './helpers';

type CallableReq = Parameters<typeof getRankings.run>[0];

function req(uid: string, data: unknown = {}): CallableReq {
  return { data, auth: { uid, token: {} } } as unknown as CallableReq;
}

interface Riga {
  rank: number;
  participantId: string;
  username: string;
  totalPoints: number;
}

async function classifica(uid: string, data: unknown = {}): Promise<Riga[]> {
  const res = (await getRankings.run(req(uid, data))) as { rankings: Riga[] };
  return res.rankings;
}

describe('getRankings', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('richiede autenticazione', async () => {
    await expect(
      getRankings.run({ data: {} } as unknown as CallableReq)
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('ordina per punti e assegna i rank', async () => {
    await seedProfile('u_terzo', 0, { username: 'Terzo', totalPoints: 10 });
    await seedProfile('u_primo', 0, { username: 'Primo', totalPoints: 90 });
    await seedProfile('u_secondo', 0, { username: 'Secondo', totalPoints: 45 });

    const righe = await classifica('u_primo');

    expect(righe.map(r => r.participantId)).toEqual(['u_primo', 'u_secondo', 'u_terzo']);
    expect(righe.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('condivide il rank a parità piena', async () => {
    await seedProfile('u_a', 0, {
      username: 'Anna', totalPoints: 40, correctPredictions: 10, bestMatchdayPoints: 20,
    });
    await seedProfile('u_b', 0, {
      username: 'Bruno', totalPoints: 40, correctPredictions: 10, bestMatchdayPoints: 20,
    });
    await seedProfile('u_c', 0, { username: 'Carla', totalPoints: 5 });

    const righe = await classifica('u_a');

    expect(righe.map(r => r.rank)).toEqual([1, 1, 3]);
  });

  it('esclude i profili disattivati (utenti bannati)', async () => {
    await seedProfile('u_attivo', 0, { username: 'Attivo', totalPoints: 10 });
    await seedProfile('u_bannato', 0, { username: 'Bannato', totalPoints: 999, isActive: false });

    const righe = await classifica('u_attivo');

    expect(righe.map(r => r.participantId)).toEqual(['u_attivo']);
  });

  it('non espone il portafoglio nelle righe di classifica', async () => {
    await seedProfile('u_solo', 777, { username: 'Solo', totalPoints: 10 });

    const [riga] = await classifica('u_solo');

    expect(riga).not.toHaveProperty('coins');
    expect(riga).not.toHaveProperty('coinsEarned');
    expect(riga).not.toHaveProperty('email');
  });

  it('con leagueId restituisce solo i membri della lega', async () => {
    await seedProfile('u_membro1', 0, { username: 'Membro1', totalPoints: 30 });
    await seedProfile('u_membro2', 0, { username: 'Membro2', totalPoints: 80 });
    await seedProfile('u_estraneo', 0, { username: 'Estraneo', totalPoints: 500 });
    await db.collection('leagues').doc('lega1').set({
      id: 'lega1', name: 'Lega Uno', isPrivate: false,
      memberIds: ['u_membro1', 'u_membro2'], ownerId: 'u_membro1',
    });

    const righe = await classifica('u_membro1', { leagueId: 'lega1' });

    expect(righe.map(r => r.participantId)).toEqual(['u_membro2', 'u_membro1']);
    expect(righe.map(r => r.rank)).toEqual([1, 2]);
  });

  it('una lega privata non è leggibile da chi non ne fa parte', async () => {
    await seedProfile('u_dentro', 0, { username: 'Dentro' });
    await seedProfile('u_fuori', 0, { username: 'Fuori' });
    await db.collection('leagues').doc('privata').set({
      id: 'privata', name: 'Privata', isPrivate: true,
      memberIds: ['u_dentro'], ownerId: 'u_dentro',
    });

    await expect(classifica('u_fuori', { leagueId: 'privata' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(await classifica('u_dentro', { leagueId: 'privata' })).toHaveLength(1);
  });

  it('una lega inesistente è un errore, non una classifica vuota', async () => {
    await seedProfile('u_qualcuno', 0, { username: 'Qualcuno' });

    await expect(classifica('u_qualcuno', { leagueId: 'mai-esistita' })).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});
