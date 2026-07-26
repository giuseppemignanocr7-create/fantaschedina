// Test del client HTTP usato per ESPN e per il provider di quote.
// Il comportamento sotto guasto è la parte che conta: senza timeout e retry
// una dipendenza lenta bloccava le Cloud Functions fino al limite di esecuzione.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// `firebase-functions` vive solo in functions/node_modules: importarlo qui
// per accedere ai mock farebbe fallire il typecheck dal tsconfig root.
// Con vi.hoisted teniamo i riferimenti senza importare nulla.
const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('firebase-functions/v2', () => ({ logger }));

import { fetchJson } from '../../../functions/src/http';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchJson — percorso felice', () => {
  it('restituisce il corpo JSON deserializzato', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ hello: 'world' })) as typeof fetch;

    const result = await fetchJson<{ hello: string }>('https://x.test/a', { label: 'test' });

    expect(result).toEqual({ hello: 'world' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('passa sempre un AbortSignal: nessuna chiamata resta appesa', async () => {
    const spy = vi.fn<typeof fetch>(async () => jsonResponse({}));
    globalThis.fetch = spy;

    await fetchJson('https://x.test/a', { label: 'test' });

    const init = spy.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchJson — errori del client (4xx)', () => {
  it('non ritenta: un 404 è deterministico e riprovare sprecherebbe quota', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(null, 404)) as typeof fetch;

    const result = await fetchJson('https://x.test/missing', { label: 'test' });

    expect(result).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('non ritenta su 401', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(null, 401)) as typeof fetch;

    await fetchJson('https://x.test/secret', { label: 'test' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchJson — errori del server (5xx)', () => {
  it('ritenta fino al numero di tentativi previsto', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(null, 503)) as typeof fetch;

    const result = await fetchJson('https://x.test/down', { label: 'test', attempts: 3 });

    expect(result).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('si ferma appena una risposta riesce', async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      return call < 3 ? jsonResponse(null, 500) : jsonResponse({ ok: true });
    }) as typeof fetch;

    const result = await fetchJson<{ ok: boolean }>('https://x.test/flaky', {
      label: 'test',
      attempts: 5,
    });

    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('fetchJson — eccezioni di rete', () => {
  it('ritenta quando fetch lancia', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;

    const result = await fetchJson('https://x.test/a', { label: 'test', attempts: 2 });

    expect(result).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('gestisce il timeout come un fallimento ritentabile', async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    }) as typeof fetch;

    const result = await fetchJson('https://x.test/slow', { label: 'espn', attempts: 2 });

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'http:failure',
      expect.objectContaining({ timeout: true, label: 'espn' })
    );
  });

  it('non propaga mai l\'eccezione al chiamante', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('boom');
    }) as typeof fetch;

    await expect(
      fetchJson('https://x.test/a', { label: 'test', attempts: 1 })
    ).resolves.toBeNull();
  });
});

describe('fetchJson — osservabilità', () => {
  it('registra un errore quando i tentativi si esauriscono', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(null, 500)) as typeof fetch;

    await fetchJson('https://x.test/down', { label: 'odds-api:events', attempts: 2 });

    // È il segnale che il runbook insegna a cercare nei log.
    expect(logger.error).toHaveBeenCalledWith(
      'http:exhausted',
      expect.objectContaining({ label: 'odds-api:events', attempts: 2 })
    );
  });

  it('non registra errori quando la chiamata riesce', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({})) as typeof fetch;

    await fetchJson('https://x.test/a', { label: 'test' });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
