// Creazione del profilo alla registrazione (src/lib/db.ts).
//
// Alla registrazione `ensureProfile` parte due volte: una da `signUp` e una
// dal listener `onAuthStateChanged`, che ha già letto "profilo assente".
// La seconda scrive su un documento appena creato, Firestore la valuta come
// update e le rules la respingono. Il profilo esiste, ma il codice trattava
// il rifiuto come errore: segnalazione a Sentry e `setProfile(null)`, cioè
// utente registrato e senza profilo caricato.
//
// Il profilo nasce in un batch insieme alla prenotazione dello username
// (collezione `usernames`), che lo rende unico senza badare alle maiuscole.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDoc = vi.fn();
const batchSet = vi.fn();
const commit = vi.fn();

vi.mock('../firebase', () => ({ db: {}, auth: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  getDoc: (...args: unknown[]) => getDoc(...args),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: (...args: unknown[]) => batchSet(...args),
    update: vi.fn(),
    delete: vi.fn(),
    commit: () => commit(),
  })),
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

/** Le scritture del batch sul profilo, nell'ordine. */
function profiliScritti(): Record<string, unknown>[] {
  return batchSet.mock.calls
    .filter(c => (c[0] as { col: string }).col === 'profiles')
    .map(c => c[1] as Record<string, unknown>);
}

beforeEach(() => {
  getDoc.mockReset();
  batchSet.mockReset();
  commit.mockReset();
});

describe('ensureProfile', () => {
  it('se il profilo esiste già lo restituisce senza scrivere', async () => {
    getDoc.mockResolvedValueOnce(snapshot({ id: 'u1', username: 'Gio' }));

    const p = await ensureProfile('u1', 'gio@example.com', 'Gio');

    expect(p).toMatchObject({ id: 'u1', username: 'Gio' });
    expect(commit).not.toHaveBeenCalled();
  });

  it('se manca lo crea con i valori iniziali e prenota lo username', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot({ id: 'u2', username: 'Ale', coins: 100 }));
    commit.mockResolvedValueOnce(undefined);

    const p = await ensureProfile('u2', 'ale@example.com', 'Ale');

    expect(commit).toHaveBeenCalledTimes(1);
    expect(profiliScritti()[0]).toMatchObject({
      id: 'u2',
      username: 'Ale',
      email: 'ale@example.com',
      coins: 100,
      coinsEarned: 0,
      totalPoints: 0,
      isActive: true,
      avatarUrl: null,
    });
    const prenotazione = batchSet.mock.calls.find(c => (c[0] as { col: string }).col === 'usernames');
    expect(prenotazione?.[0]).toMatchObject({ id: 'ale' });
    expect(prenotazione?.[1]).toMatchObject({ uid: 'u2' });
    expect(p).toMatchObject({ id: 'u2', coins: 100 });
  });

  it('porta il nome di Google al formato ammesso', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot({ id: 'u5' }));
    commit.mockResolvedValueOnce(undefined);

    await ensureProfile('u5', 'm@example.com', 'Mario Rossì');

    expect(profiliScritti()[0].username).toBe('Mario_Rossi');
  });

  it('se lo username è già preso riprova con un suffisso', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null)) // profilo assente
      .mockResolvedValueOnce(snapshot(null)) // ancora assente dopo il rifiuto
      .mockResolvedValueOnce(snapshot({ id: 'u6' }));
    commit.mockRejectedValueOnce(PERMISSION_DENIED).mockResolvedValueOnce(undefined);

    await ensureProfile('u6', 'x@example.com', 'Preso');

    const nomi = profiliScritti().map(p => p.username as string);
    expect(nomi[0]).toBe('Preso');
    expect(nomi[1]).toMatch(/^Preso_\d{4}$/);
  });

  it('REGRESSIONE: se una chiamata concorrente lo ha appena creato, lo rilegge invece di fallire', async () => {
    getDoc
      .mockResolvedValueOnce(snapshot(null)) // qui il profilo non c'era ancora
      .mockResolvedValueOnce(snapshot({ id: 'u3', username: 'Concorrente' })); // nel frattempo creato
    commit.mockRejectedValueOnce(PERMISSION_DENIED);

    const p = await ensureProfile('u3', 'c@example.com', 'Concorrente');

    expect(p).toMatchObject({ id: 'u3', username: 'Concorrente' });
  });

  it('un rifiuto vero resta un errore: il profilo non c\'è nemmeno dopo', async () => {
    getDoc.mockResolvedValue(snapshot(null));
    commit.mockRejectedValue(PERMISSION_DENIED);

    await expect(ensureProfile('u4', 'x@example.com', 'Xyz')).rejects.toThrow(
      'PERMISSION_DENIED'
    );
    expect(commit).toHaveBeenCalledTimes(5);
  });
});
