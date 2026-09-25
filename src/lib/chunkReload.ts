// ============================================
// PEZZI DI APP VECCHI DOPO UN AGGIORNAMENTO
// Le pagine si caricano a pezzi (chunk) con un nome che cambia a ogni
// rilascio. Chi ha l'app aperta da prima di un aggiornamento chiede un pezzo
// che non esiste piu' e restava su "Ops, autogol!". Si ricarica la pagina,
// una volta sola: se il pezzo manca ancora non si entra in un ciclo infinito.
// ============================================

const CHIAVE = 'fs_ricarica_chunk';

/** L'errore e' quello di un pezzo di app che non si trova piu' sul server. */
export function isChunkLoadError(err: unknown): boolean {
  const msg =
    err instanceof Error ? `${err.name} ${err.message}` : typeof err === 'string' ? err : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading (CSS )?chunk .* failed|Unable to preload CSS/i.test(
    msg
  );
}

/**
 * Ricarica la pagina se non lo si e' gia' fatto in questa sessione.
 * Risponde true se la ricarica e' partita.
 */
export function ricaricaUnaVolta(): boolean {
  try {
    if (sessionStorage.getItem(CHIAVE)) return false;
    sessionStorage.setItem(CHIAVE, String(Date.now()));
  } catch {
    // Storage non disponibile (navigazione privata, permessi): senza la
    // guardia non si rischia un ciclo di ricariche, meglio non ricaricare.
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Da chiamare all'avvio. Vite emette `vite:preloadError` quando un pezzo non
 * si carica; qualche secondo dopo un avvio riuscito la guardia si toglie, cosi'
 * un aggiornamento successivo nella stessa sessione puo' ricaricare di nuovo.
 */
export function installaRicaricaChunk(): void {
  window.addEventListener('vite:preloadError', evento => {
    if (ricaricaUnaVolta()) evento.preventDefault();
  });
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(CHIAVE);
    } catch {
      /* storage non disponibile: niente da togliere */
    }
  }, 10_000);
}
