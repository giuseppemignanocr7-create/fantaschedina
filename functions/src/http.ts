// ============================================
// FANTASCHEDINA FUNCTIONS - CLIENT HTTP RESILIENTE
//
// Ogni chiamata verso un servizio esterno (ESPN, odds provider) deve avere
// un timeout esplicito: senza, una risposta lenta tiene occupata la function
// fino al limite di esecuzione, consuma quota e blocca il settlement.
//
// Fornisce inoltre retry con backoff esponenziale + jitter e un logging
// esplicito dei fallimenti: prima i `catch` restituivano `null` in silenzio
// e un provider degradato era indistinguibile da "nessun dato disponibile".
// ============================================

import { logger } from 'firebase-functions/v2';

export interface FetchJsonOptions {
  /** Timeout per singolo tentativo, in millisecondi. */
  timeoutMs?: number;
  /** Numero di tentativi totali (1 = nessun retry). */
  attempts?: number;
  /** Etichetta usata nei log per identificare la dipendenza. */
  label: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ATTEMPTS = 3;

function backoffDelay(attempt: number): number {
  const base = Math.min(2_000, 250 * 2 ** (attempt - 1));
  // jitter pieno: evita che più istanze riprovino nello stesso istante
  return Math.round(Math.random() * base);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET JSON con timeout, retry e logging. Restituisce `null` quando la
 * risorsa non è ottenibile: i chiamanti trattano già questo caso come
 * "dato non disponibile" e degradano di conseguenza.
 *
 * Non ritenta sugli errori 4xx: sono deterministici e un nuovo tentativo
 * produrrebbe lo stesso esito sprecando quota.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T | null> {
  const { label } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

      if (res.ok) {
        return (await res.json()) as T;
      }

      if (res.status >= 400 && res.status < 500) {
        logger.warn('http:client-error', { label, status: res.status, attempt });
        return null;
      }

      logger.warn('http:server-error', { label, status: res.status, attempt, attempts });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      logger.warn('http:failure', {
        label,
        attempt,
        attempts,
        timeout: isTimeout,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (attempt < attempts) {
      await sleep(backoffDelay(attempt));
    }
  }

  logger.error('http:exhausted', { label, attempts });
  return null;
}
