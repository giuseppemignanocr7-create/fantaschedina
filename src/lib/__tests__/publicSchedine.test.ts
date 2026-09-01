// Schedine pubbliche di un giocatore (src/lib/db.ts).
//
// Le regole lasciano leggere agli altri solo le schedine con settled==true,
// quindi la query filtra così — e il resto (solo circuito generale, ordine
// dalla giornata più recente) lo fa il client. Se questo filtro sbagliasse,
// il profilo di un giocatore mostrerebbe le sue schedine di lega o le
// mostrerebbe in ordine sparso.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocs = vi.fn();

vi.mock('../firebase', () => ({ db: {}, auth: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  getDoc: vi.fn(),
  getDocs: (...args: unknown[]) => getDocs(...args),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn((campo: string, _op: string, valore: unknown) => ({ campo, valore })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: { fromDate: vi.fn(), now: vi.fn() },
}));
vi.mock('../gameApi', () => ({ getPublicProfilesFn: vi.fn(), getRankingsFn: vi.fn() }));

const { getPublicSchedine } = await import('../db');

function schedina(matchdayNumber: number, leagueId: string | null = null) {
  return {
    data: () => ({
      id: `u1_${matchdayNumber}${leagueId ? `_${leagueId}` : ''}`,
      userId: 'u1',
      matchdayNumber,
      leagueId,
      settled: true,
      finalPoints: matchdayNumber * 10,
    }),
  };
}

beforeEach(() => {
  getDocs.mockReset();
});

describe('getPublicSchedine', () => {
  it('tiene solo il circuito generale: le schedine di lega restano fuori', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [schedina(1), schedina(1, 'lega_amici'), schedina(2, 'lega_lavoro')],
    });

    const res = await getPublicSchedine('u1');

    expect(res).toHaveLength(1);
    expect(res[0].matchdayNumber).toBe(1);
  });

  it('ordina dalla giornata più recente, qualunque ordine arrivi dal server', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [schedina(2), schedina(7), schedina(4)],
    });

    const res = await getPublicSchedine('u1');

    expect(res.map(s => s.matchdayNumber)).toEqual([7, 4, 2]);
  });

  it('senza schedine valutate restituisce una lista vuota, non un errore', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] });

    expect(await getPublicSchedine('u1')).toEqual([]);
  });
});
