// ============================================
// FANTA SCHEDINA — ERROR TRACKING
//
// Senza questo modulo un crash in produzione finiva su console.error e
// nessuno ne veniva a conoscenza. Qui gli errori arrivano a un servizio
// esterno, associati alla release che li ha introdotti.
//
// Se `VITE_SENTRY_DSN` non è configurata il modulo resta inerte: l'app
// funziona normalmente e in sviluppo non si inquina il progetto Sentry.
// ============================================

import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = import.meta.env.VITE_APP_VERSION as string | undefined;

let enabled = false;

/** Campi che non devono mai lasciare il browser. */
const PII_KEYS = ['email', 'password', 'newPassword', 'confirmPassword', 'token', 'idToken'];

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_KEYS.includes(k) ? '[rimosso]' : scrub(v, depth + 1);
  }
  return out;
}

export function initMonitoring(): void {
  if (!DSN || enabled) return;

  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: import.meta.env.MODE,
    // 10%: abbastanza per vedere le tendenze senza esaurire la quota gratuita
    tracesSampleRate: 0.1,
    // L'invio automatico di IP e dati utente resta disattivato: raccogliamo
    // solo l'uid, che è uno pseudonimo (vedi informativa privacy).
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) delete event.request.headers;
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      return event;
    },
  });

  enabled = true;
}

/**
 * Associa gli errori successivi all'utente corrente. Passiamo solo l'uid:
 * email e username non sono necessari per il debug e sono dati personali.
 */
export function identifyUser(uid: string | null): void {
  if (!enabled) return;
  Sentry.setUser(uid ? { id: uid } : null);
}

/** Segnala un errore gestito, con contesto opzionale già ripulito. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) {
    if (import.meta.env.DEV) console.error('[monitoring]', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: scrub(context) as Record<string, unknown> } : undefined);
}
