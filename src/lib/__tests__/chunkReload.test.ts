import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, ricaricaUnaVolta } from '../chunkReload';

function storage(): Storage {
  const dati = new Map<string, string>();
  return {
    getItem: k => dati.get(k) ?? null,
    setItem: (k, v) => void dati.set(k, v),
    removeItem: k => void dati.delete(k),
    clear: () => dati.clear(),
    key: () => null,
    get length() {
      return dati.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isChunkLoadError', () => {
  it('riconosce i pezzi di app mancanti', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError('error loading dynamically imported module')).toBe(true);
  });

  it('lascia stare gli altri errori', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('ricaricaUnaVolta', () => {
  it('ricarica la prima volta e poi non piu', () => {
    const reload = vi.fn();
    vi.stubGlobal('sessionStorage', storage());
    vi.stubGlobal('window', { location: { reload } });
    expect(ricaricaUnaVolta()).toBe(true);
    expect(ricaricaUnaVolta()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('senza storage non ricarica, per non entrare in un ciclo', () => {
    const reload = vi.fn();
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('negato');
      },
    });
    vi.stubGlobal('window', { location: { reload } });
    expect(ricaricaUnaVolta()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
