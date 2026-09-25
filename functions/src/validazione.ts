// ============================================
// FANTASCHEDINA FUNCTIONS - VALIDAZIONE DEI PRONOSTICI
// Logica pura: decide se i pronostici mandati dal client si possono giocare
// e li riscrive con le quote ufficiali. Niente Firestore, cosi' si prova con
// i test unitari. La usano submitSchedina e changePrediction.
// ============================================

import { TOURNAMENT } from './config';
import type { MatchOdds } from './odds';
import type { Prediction } from './scoring';

/** Mercati che il gioco sa valutare (vedi evaluateBet). */
export const MERCATI = [
  'esito',
  'over_under',
  'goal_nogoal',
  'doppia_chance',
  'multigoal',
  'esito_1t',
  'over_under_1t',
  'goal_nogoal_1t',
] as const;

const MERCATI_NOTI = new Set<string>(MERCATI);

/** Linea del multigoal: "O2.5", "U1.5". Altrimenti evaluateBet la annullerebbe. */
const MULTIGOAL = /^[OU]\d+(\.\d+)?$/;

export interface PartitaGiocabile {
  id: string;
  status: string;
  kickoffMs: number;
}

export type EsitoValidazione<T> =
  | { ok: true; valore: T }
  | { ok: false; codice: 'invalid-argument' | 'failed-precondition'; messaggio: string };

function errore(
  messaggio: string,
  codice: 'invalid-argument' | 'failed-precondition' = 'invalid-argument'
): { ok: false; codice: 'invalid-argument' | 'failed-precondition'; messaggio: string } {
  return { ok: false, codice, messaggio };
}

/** Chiave propria dell'oggetto, mai ereditata dal prototipo. */
function proprio(obj: object, chiave: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, chiave);
}

/** Partita non ancora cominciata: stato programmato e fischio d'inizio nel futuro. */
export function partitaNonIniziata(p: PartitaGiocabile, nowMs: number): boolean {
  return (p.status === 'scheduled' || p.status === 'pre') && p.kickoffMs > nowMs;
}

/**
 * Quota ufficiale di un pronostico, o il motivo per cui non si gioca.
 *
 * Tutto quello che arriva dal client e' sospetto: si accettano solo stringhe,
 * solo mercati noti, solo esiti che siano chiavi proprie delle quote (niente
 * `__proto__` o `constructor` pescati dal prototipo) e solo quote vere del
 * bookmaker, finite e non sotto la soglia minima del gioco.
 */
export function quotaUfficiale(
  quote: Record<string, MatchOdds>,
  matchId: unknown,
  betType: unknown,
  outcome: unknown
): EsitoValidazione<number> {
  if (typeof matchId !== 'string' || typeof betType !== 'string' || typeof outcome !== 'string') {
    return errore('Pronostico non valido');
  }
  if (!MERCATI_NOTI.has(betType)) return errore('Mercato non valido');
  if (!proprio(quote, matchId)) return errore('Partita senza quote');
  const partita = quote[matchId] as unknown as Record<string, unknown> | undefined;
  if (!partita || typeof partita !== 'object' || !proprio(partita, betType)) {
    return errore('Mercato non quotato per questa partita');
  }
  const mercato = partita[betType] as Record<string, unknown> | null;
  if (!mercato || typeof mercato !== 'object' || !proprio(mercato, outcome)) {
    return errore('Esito non valido');
  }
  if (betType === 'multigoal' && !MULTIGOAL.test(outcome)) return errore('Esito non valido');
  const quota = mercato[outcome];
  if (typeof quota !== 'number' || !Number.isFinite(quota) || quota <= 1) {
    return errore('Quota non disponibile');
  }
  if (quota < TOURNAMENT.penaltyOddsMin) {
    return errore(
      `Quota troppo bassa: si gioca solo da ${TOURNAMENT.penaltyOddsMin.toFixed(2)} in su`
    );
  }
  return { ok: true, valore: quota };
}

/**
 * Valida una schedina intera.
 *
 * - un array di esattamente `richieste` pronostici (vedi pickRichieste);
 * - ogni partita della giornata, non ancora cominciata, una volta sola;
 * - ogni pronostico con la sua quota ufficiale (vedi quotaUfficiale).
 *
 * Restituisce i pronostici puliti: solo i quattro campi, quota del server.
 */
export function validaPronostici(
  input: unknown,
  ctx: {
    partite: PartitaGiocabile[];
    quote: Record<string, MatchOdds>;
    richieste: number;
    nowMs: number;
  }
): EsitoValidazione<Prediction[]> {
  if (!Array.isArray(input) || input.length === 0) return errore('Pronostici mancanti');
  if (ctx.richieste <= 0) {
    return errore('Nessuna partita quotata in questa giornata', 'failed-precondition');
  }
  const partite = new Map(ctx.partite.map(p => [p.id, p]));
  const viste = new Set<string>();
  const puliti: Prediction[] = [];
  for (const grezzo of input) {
    if (!grezzo || typeof grezzo !== 'object') return errore('Pronostico non valido');
    const { matchId, betType, outcome } = grezzo as Record<string, unknown>;
    if (typeof matchId !== 'string' || !partite.has(matchId)) {
      return errore('Partita non valida');
    }
    if (viste.has(matchId)) return errore('Un solo pronostico per partita');
    viste.add(matchId);
    if (!partitaNonIniziata(partite.get(matchId) as PartitaGiocabile, ctx.nowMs)) {
      return errore('Partita gia\' iniziata: non si puo\' piu\' pronosticare', 'failed-precondition');
    }
    const quota = quotaUfficiale(ctx.quote, matchId, betType, outcome);
    if (!quota.ok) return quota;
    puliti.push({
      matchId,
      betType: betType as string,
      outcome: outcome as string,
      odds: quota.valore,
    });
  }
  // Il conteggio per ultimo: un pronostico su una partita gia' iniziata va
  // segnalato come tale, non come "numero sbagliato di partite".
  if (puliti.length !== ctx.richieste) {
    return errore(`Devi scegliere esattamente ${ctx.richieste} partite`);
  }
  return { ok: true, valore: puliti };
}
