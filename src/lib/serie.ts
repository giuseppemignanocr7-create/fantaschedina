// ============================================
// FANTA SCHEDINA - SERIE GIORNALIERA (lettura lato client)
//
// Il conteggio e il bonus li decide il server (functions/src/streak.ts): qui
// si legge soltanto lo stato scritto sul profilo per dire all'utente a che
// punto e' e cosa rischia. Modulo puro, senza Firebase, cosi' si prova nei
// test unitari che girano in CI senza variabili d'ambiente.
// ============================================

import { STREAK } from './economy';

export interface StatoSerieUI {
  /** Giorni consecutivi da mostrare (0 = nessuna serie in corso). */
  giorni: number;
  /** Oggi ha gia' giocato: la serie e' al sicuro. */
  giocatoOggi: boolean;
  /** Ha giocato ieri ma non oggi: giocando adesso la serie continua. */
  aRischio: boolean;
  /** Gettoni che vale la prossima presenza. */
  prossimoBonus: number;
}

/** Data di oggi nel fuso di Roma, `YYYY-MM-DD`: stesso formato del server. */
export function oggiRoma(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function giornoPrima(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return '';
  const [anno, mese, giorno] = data.split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function bonus(giorni: number): number {
  if (giorni <= 0) return 0;
  return Math.min(giorni * STREAK.bonusPerGiorno, STREAK.bonusMassimo);
}

/**
 * Stato da mostrare, dai campi `streakDate`/`streakDays` del profilo.
 * Una serie interrotta (ultimo giorno piu' vecchio di ieri) vale zero: il
 * server la azzerera' alla prossima partita, e mostrarla viva sarebbe una
 * bugia verso chi ha gia' saltato il giro.
 */
export function statoSerie(
  streakDate: string | undefined,
  streakDays: number | undefined,
  oggi = oggiRoma()
): StatoSerieUI {
  const giorniSalvati = Number.isFinite(streakDays) ? Math.max(0, Math.floor(streakDays as number)) : 0;

  if (streakDate === oggi && giorniSalvati > 0) {
    return {
      giorni: giorniSalvati,
      giocatoOggi: true,
      aRischio: false,
      prossimoBonus: bonus(giorniSalvati + 1),
    };
  }

  if (!!streakDate && streakDate === giornoPrima(oggi) && giorniSalvati > 0) {
    return {
      giorni: giorniSalvati,
      giocatoOggi: false,
      aRischio: true,
      prossimoBonus: bonus(giorniSalvati + 1),
    };
  }

  return { giorni: 0, giocatoOggi: false, aRischio: false, prossimoBonus: bonus(1) };
}
