// Creazione del profilo alla registrazione (src/lib/db.ts).
//
// Alla registrazione `ensureProfile` parte due volte: una da `signUp` e una
// dal listener `onAuthStateChanged`, che ha già letto "profilo assente".
// La seconda scrive su un documento appena creato, Firestore la valuta come
// update e le rules la respingono. Il profilo esiste, ma il codice trattava
// il rifiuto come errore: segnalazione a Sentry e `setProfile(null)`, cioè
// utente registrato e senza profilo caricato.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock('../firebase', () => ({ db: {}, auth: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  getDoc: (...args: unknown[]) => getDoc(...args),
  getDocs: vi.fn(),
  setDoc: (...args: unknown[]) => setDoc(...args),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  onSnapshot: vi.fn(),
  Timestamp: { fromDate: vi.fn(), now: vi.fn() },
}));
vi.mock('../gameApi', () => ({ getPublicProfilesFn: vi.fn() }));

const { ensureProfile } = await import('../db');

/** Snapshot finto: `exists()` e `data()` come li usa il codice. */
function snapshot(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

const PERMISSION_DENIED = Object.assign(new Error('PERMISSION_DENIED'), {
  code: 'permission-denied',
});

beforeEach(() => {
  getDoc.mockReset();
  setDoc.mockReset();
});

describe('ensureProfile', () => {
  it('se il profilo esiste già lo restituisce senza scrivere', async () => {
    getDoc.mockResolvedValueOnce(snapshot({ id: 'u1', username: 'Gio' }));

    const p = await ensureProfile('u1', 'gio@example.com', 'Gio');

    expect(p).toMatchObject({ id: 'u1', username: 'Gio' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('se manca lo crea con i valori iniziali', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot({ id: 'u2', username: 'Ale', coins: 100 }));
    setDoc.mockResolvedValueOnce(undefined);

    const p = await ensureProfile('u2', 'ale@example.com', 'Ale');

    expect(setDoc).toHaveBeenCalledTimes(1);
    const scritto = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(scritto).toMatchObject({
      id: 'u2',
      username: 'Ale',
      email: 'ale@example.com',
      coins: 100,
      coinsEarned: 0,
      totalPoints: 0,
      isActive: true,
      avatarUrl: null,
    });
    expect(p).toMatchObject({ id: 'u2', coins: 100 });
  });

  it('REGRESSIONE: se una chiamata concorrente lo ha appena creato, lo rilegge invece di fallire', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null)) // qui il profilo non c'era ancora
      .mockResolvedValueOnce(snapshot({ id: 'u3', username: 'Concorrente' })); // nel frattempo creato
    setDoc.mockRejectedValueOnce(PERMISSION_DENIED);

    const p = await ensureProfile('u3', 'c@example.com', 'Concorrente');

    expect(p).toMatchObject({ id: 'u3', username: 'Concorrente' });
  });

  it('un rifiuto vero resta un errore: il profilo non c\'è nemmeno dopo', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot(null));
    setDoc.mockRejectedValueOnce(PERMISSION_DENIED);

    await expect(ensureProfile('u4', 'x@example.com', 'X')).rejects.toThrow(
      'PERMISSION_DENIED'
    );
  });
});
