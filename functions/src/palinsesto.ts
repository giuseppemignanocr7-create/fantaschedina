// ============================================
// FANTASCHEDINA FUNCTIONS - PALINSESTO DELLA GIORNATA
//
// Regole pure (niente rete, niente Firestore) con cui la sincronizzazione e
// gli aggiornamenti live tengono insieme partite e quote della giornata:
// quali quote si tengono, quali si tolgono, quali restano ferme, e come si
// fondono due scritture concorrenti sulla stessa partita. Stanno qui per
// poterle provare una per una.
// ============================================

import type { MatchOdds } from './odds';
import type { MatchResult } from './scoring';

/**
 * Codice campionato interno (COMPETITIONS in config.ts) → slug lega su
 * odds-api.io. uefa.champions/uefa.europa non hanno ancora uno slug stabile
 * fuori stagione (solo turni di qualificazione con nomi variabili): quando
 * riparte la fase a gironi va aggiunto qui. Un campionato che non compare qui
 * non ha quote, quindi non si puo' attivare (vedi adminManageCompetitions).
 */
export const ODDS_API_LEAGUE_SLUG: Record<string, string> = {
  'ita.1': 'italy-serie-a',
  'eng.1': 'england-premier-league',
  'esp.1': 'spain-laliga',
  'ger.1': 'germany-bundesliga',
  'fra.1': 'france-ligue-1',
  'ita.coppa_italia': 'italy-coppa-italia',
  'bra.1': 'brazil-brasileiro-serie-a',
  'usa.1': 'usa-mls',
};

/** Slug del fornitore di quote per un campionato, se esiste. */
export function slugFornitore(code: string): string | undefined {
  return ODDS_API_LEAGUE_SLUG[code];
}

/**
 * Stati di una partita salvati sulla giornata. Gli ultimi tre arrivano da
 * ESPN quando la partita non si gioca (o non si chiude) regolarmente: restano
 * scritti cosi' perche' la valutazione possa annullare i pronostici su quelle
 * partite invece di aspettarle per sempre.
 */
export type StatoPartita =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'canceled'
  | 'abandoned';

/** Rinviata, cancellata o sospesa definitivamente. */
export function eSospesa(status: string): boolean {
  return status === 'postponed' || status === 'canceled' || status === 'abandoned';
}

/**
 * Partita gia' cominciata: le sue quote sono quelle su cui sono state giocate
 * le schedine e non si toccano piu'. Una partita sospesa a gara in corso e'
 * cominciata; una rinviata o cancellata no.
 */
export function partitaIniziata(status: string, kickoffMs: number, oraMs: number): boolean {
  if (status === 'live' || status === 'finished' || status === 'abandoned') return true;
  if (status === 'postponed' || status === 'canceled') return false;
  return kickoffMs <= oraMs;
}

/** Si quota solo una partita ancora da giocare e con l'orario nel futuro. */
export function partitaQuotabile(status: string, kickoffMs: number, oraMs: number): boolean {
  return status === 'scheduled' && kickoffMs > oraMs;
}

/** Una partita e' giocabile solo se l'agenzia ne pubblica almeno l'1X2. */
export function haEsito(odds: Partial<MatchOdds> | undefined): boolean {
  return !!odds?.esito;
}

export interface OpzioniUnione {
  /**
   * Partite che la mappa puo' contenere: le iniziate (ferme) piu' quelle
   * quotabili. Tutto il resto esce: partite tolte dalla giornata, rinviate,
   * cancellate.
   */
  partite: Iterable<string>;
  /**
   * Partite per cui il fornitore ha dato una risposta certa in questo giro
   * (evento trovato e quote lette, oppure evento non piu' in palinsesto). Solo
   * per queste l'assenza di quote vuol dire "ritirate"; per le altre (errore di
   * rete, fornitore giu') si tiene quello che c'era.
   */
  verificate: Iterable<string>;
  /** Richiesta dell'amministratore: le quote nuove sostituiscono le vecchie. */
  riquota?: boolean;
}

/**
 * Nuova mappa quote di un'agenzia per la giornata, costruita da zero a ogni
 * sincronizzazione (niente chiavi vecchie che sopravvivono per sbaglio):
 *
 * - partita cominciata: quota ferma com'era, non si aggiorna e non si toglie
 *   (se non l'aveva, non la prende adesso);
 * - partita da giocare con quote dal fornitore: le tiene; se ne aveva gia'
 *   restano le pubblicate, a meno che l'amministratore chieda di riquotare;
 * - partita da giocare che il fornitore ha ritirato: esce, e non si gioca;
 * - partita da giocare senza risposta certa: resta com'era, si riprova al
 *   giro dopo (una partita mai quotata si ritenta sempre, non c'e' memoria
 *   dei "mancanti");
 * - partite fuori da `partite`: escono.
 *
 * Nessuna quota viene calcolata o presa da un'altra agenzia.
 */
export function unisciQuote(
  prev: Record<string, MatchOdds> | undefined,
  nuove: Record<string, MatchOdds> | undefined,
  partiteIniziate: Iterable<string>,
  opzioni: OpzioniUnione
): Record<string, MatchOdds> {
  const vecchie = prev ?? {};
  const fresche = nuove ?? {};
  const iniziate = new Set(partiteIniziate);
  const verificate = new Set(opzioni.verificate);
  const out: Record<string, MatchOdds> = {};
  for (const id of new Set(opzioni.partite)) {
    if (iniziate.has(id)) {
      if (vecchie[id]) out[id] = vecchie[id];
      continue;
    }
    if (haEsito(fresche[id])) {
      out[id] = opzioni.riquota || !vecchie[id] ? fresche[id] : vecchie[id];
      continue;
    }
    if (verificate.has(id)) continue;
    if (vecchie[id]) out[id] = vecchie[id];
  }
  return out;
}

/** Quante partite della giornata hanno l'1X2 di quell'agenzia. */
export function contaQuotate(
  odds: Record<string, MatchOdds> | undefined,
  matchIds: Iterable<string>
): number {
  let n = 0;
  for (const id of matchIds) if (haEsito(odds?.[id])) n += 1;
  return n;
}

/**
 * Stato da salvare quando la sincronizzazione rilegge una partita da ESPN.
 * La sincronizzazione registra solo rinvii e riprogrammazioni: l'avanzamento
 * in campo (live, finita) lo scrivono gli aggiornamenti live e la
 * valutazione. Dopo la deadline un rinvio resta tale anche se ESPN la
 * riprogramma: le schedine sono chiuse e quella partita va annullata, non
 * aspettata.
 */
export function statoDaSync(salvato: string, espn: string | undefined, bloccata: boolean): string {
  if (!espn || salvato === 'finished') return salvato;
  if (eSospesa(espn)) return espn;
  if (eSospesa(salvato)) return !bloccata && espn === 'scheduled' ? 'scheduled' : salvato;
  return salvato;
}

/**
 * Applica un aggiornamento live alla versione piu' recente della partita
 * (letta nella stessa transazione). Una partita gia' chiusa non torna
 * indietro, e il parziale di primo tempo gia' salvato non si perde se
 * l'aggiornamento non lo riporta.
 */
export function applicaAggiornamento<M extends { status: string; result?: MatchResult }>(
  partita: M,
  agg: { status: string; result?: MatchResult }
): M {
  if (partita.status === 'finished' && agg.status !== 'finished') return partita;
  if (!agg.result) return { ...partita, status: agg.status };
  const salvato = partita.result;
  const parziale =
    agg.result.htHomeGoals == null && salvato?.htHomeGoals != null && salvato.htAwayGoals != null
      ? { htHomeGoals: salvato.htHomeGoals, htAwayGoals: salvato.htAwayGoals }
      : {};
  return { ...partita, status: agg.status, result: { ...agg.result, ...parziale } };
}
