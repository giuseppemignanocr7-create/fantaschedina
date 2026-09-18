// ============================================
// FANTASCHEDINA FUNCTIONS - SERIE GIORNALIERA
//
// Le missioni premiano i traguardi lontani (10 giornate, 50 pronostici): danno
// un motivo per restare, non per tornare oggi. La serie premia la presenza del
// giorno e si azzera se si salta, che e' la leva di ritorno piu' economica.
//
// Logica pura, senza Firestore: il calcolo decide gettoni, quindi va provato
// da solo (test in src/lib/__tests__/functionsStreak.test.ts).
// ============================================

import { STREAK } from './config';

export interface StatoSerie {
  /** Giorni consecutivi di presenza, oggi compreso. */
  giorni: number;
  /** Gettoni da accreditare adesso (0 se oggi era gia' stato contato). */
  bonus: number;
  /** true se questa e' la prima presenza di oggi: solo allora si accredita. */
  nuovoGiorno: boolean;
}

/**
 * Giorno di calendario precedente, su date `YYYY-MM-DD`. L'aritmetica e' in
 * UTC ma le date arrivano gia' espresse nel fuso di Roma (romeDateString):
 * qui si contano giorni di calendario, non istanti, quindi non c'e' conversione
 * di fuso da fare e il cambio dell'ora legale non sposta nulla.
 */
export function giornoPrecedente(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return '';
  const [anno, mese, giorno] = data.split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bonus del giorno n della serie: cresce di `bonusPerGiorno` fino al tetto.
 * Il tetto esiste perche' una serie lunga non deve diventare la sorgente
 * principale di gettoni del gioco: resta un premio per la costanza.
 */
export function bonusSerie(giorni: number): number {
  if (!Number.isFinite(giorni) || giorni <= 0) return 0;
  return Math.min(Math.floor(giorni) * STREAK.bonusPerGiorno, STREAK.bonusMassimo);
}

/**
 * Stato della serie dopo una presenza di oggi.
 *
 * - stesso giorno: niente, il bonus si prende una volta sola;
 * - giorno subito precedente: la serie continua;
 * - piu' indietro (o mai giocato): la serie riparte da uno.
 */
export function calcolaSerie(
  ultimoGiorno: string | undefined | null,
  giorniPrecedenti: number,
  oggi: string
): StatoSerie {
  const precedenti = Number.isFinite(giorniPrecedenti) ? Math.max(0, Math.floor(giorniPrecedenti)) : 0;

  if (ultimoGiorno === oggi) {
    // Gia' contato: `precedenti` puo' essere 0 solo su dati incoerenti.
    return { giorni: Math.max(1, precedenti), bonus: 0, nuovoGiorno: false };
  }

  const continua = !!ultimoGiorno && ultimoGiorno === giornoPrecedente(oggi);
  const giorni = continua ? precedenti + 1 : 1;
  return { giorni, bonus: bonusSerie(giorni), nuovoGiorno: true };
}
