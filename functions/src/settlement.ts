// ============================================
// FANTASCHEDINA FUNCTIONS - REGOLE DI SETTLEMENT
// Logica pura della valutazione di giornata, isolata per poterla testare
// senza Firestore.
// ============================================

export interface WeeklyCandidate {
  userId: string;
  finalPoints: number;
  correctPredictions: number;
  /** Millisecondi dell'invio. Assente = trattato come "arrivato per ultimo". */
  submittedAtMs?: number;
}

/**
 * Vincitore di giornata.
 *
 * A parità di punti serve un criterio: prima si guardava solo `finalPoints` e
 * vinceva la prima schedina che Firestore restituiva, cioè un ordine di
 * documenti — il premio da 100 gettoni finiva di fatto a caso, e la stessa
 * giornata rivalutata poteva dare un vincitore diverso.
 *
 * Ordine dei criteri, dal più importante:
 *   1. punti finali più alti
 *   2. più pronostici esatti (stessi punti con meno errori)
 *   3. schedina consegnata prima
 *   4. userId, solo per avere un risultato deterministico
 */
export function pickWeeklyWinner(
  candidates: WeeklyCandidate[]
): WeeklyCandidate | null {
  return rankWeeklyCandidates(candidates)[0] ?? null;
}

/**
 * Classifica di giornata completa, con gli stessi criteri del vincitore.
 * Serve per il podio: i premi settimanali sono tre, non uno.
 */
export function rankWeeklyCandidates(
  candidates: WeeklyCandidate[]
): WeeklyCandidate[] {
  return candidates.slice().sort(confrontaCandidati);
}

function confrontaCandidati(a: WeeklyCandidate, b: WeeklyCandidate): number {
  if (a.finalPoints !== b.finalPoints) return b.finalPoints - a.finalPoints;
  if (a.correctPredictions !== b.correctPredictions) {
    return b.correctPredictions - a.correctPredictions;
  }
  const aMs = a.submittedAtMs ?? Number.POSITIVE_INFINITY;
  const bMs = b.submittedAtMs ?? Number.POSITIVE_INFINITY;
  if (aMs !== bMs) return aMs - bMs;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}
