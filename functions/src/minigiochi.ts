// ============================================
// FANTASCHEDINA FUNCTIONS - REGOLE PURE DEI MINIGIOCHI
//
// Tetti giornalieri, sessioni di gioco, serie, codice dei duelli e
// composizione di un round del duello. Logica senza Firestore: decide gettoni
// e chi vince, quindi va provata da sola (test in
// src/lib/__tests__/functionsMinigiochi.test.ts).
// ============================================

import { randomInt } from 'node:crypto';
import { COINS } from './config';
import { intInRange } from './input';
import type { PenaltyZone } from './penalty';

// ---------- Tetti giornalieri ----------

/**
 * Quanto si accredita davvero di un premio, dato il tetto del giorno e quanto
 * si e' gia' incassato oggi. Mai negativo, mai oltre il premio pieno.
 */
export function premioConTetto(premio: number, tetto: number, giaOggi: number): number {
  const p = Number.isFinite(premio) ? Math.max(0, Math.floor(premio)) : 0;
  const gia = Number.isFinite(giaOggi) ? Math.max(0, giaOggi) : 0;
  const residuo = Math.max(0, tetto - gia);
  return Math.min(p, residuo);
}

// ---------- Serie giornaliera ----------

/**
 * Azioni di `playMinigame` che sono una partita finita. Solo queste contano
 * per la serie: aprire un quiz o una sfida e andarsene non e' aver giocato.
 */
const AZIONI_PARTITA_COMPLETA = new Set([
  'quiz_submit',
  'wheel_spin',
  'sfida_play',
  'memoria_play',
]);

export function contaPerLaSerie(action: string): boolean {
  return AZIONI_PARTITA_COMPLETA.has(action);
}

// ---------- Codice dei duelli ----------

/** Niente 0/O, 1/I: si detta a voce senza equivoci. */
export const ALFABETO_CODICE_DUELLO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Codice di sei caratteri per unirsi a un duello. L'indice va estratto sulla
 * lunghezza dell'alfabeto: prima era `randomInt(34)` su 32 lettere, e due
 * estrazioni su 34 davano `undefined` dentro al codice.
 */
export function generaCodiceDuello(estrai: (max: number) => number = randomInt): string {
  return Array.from(
    { length: 6 },
    () => ALFABETO_CODICE_DUELLO[estrai(ALFABETO_CODICE_DUELLO.length)]
  ).join('');
}

// ---------- Round del duello ----------

export interface MossaDuello {
  zone: PenaltyZone;
  /** Potenza del tiro (0-100); 0 per chi para. */
  power: number;
}

export interface RoundComposto {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  power: number;
  p1Choice: PenaltyZone;
  p2Choice: PenaltyZone;
}

/**
 * Mette insieme le due mosse di un round: chi attacca da' zona e potenza del
 * tiro, chi para solo la zona del tuffo. La regola e' la stessa chiunque sia
 * p1 o p2, umano o bot; una mossa mancante (tempo scaduto) la sceglie `casuale`.
 */
export function componiRound(
  attacker: 1 | 2,
  mossaP1: MossaDuello | null,
  mossaP2: MossaDuello | null,
  casuale: (attacca: boolean) => MossaDuello
): RoundComposto {
  const mossaAttacco = (attacker === 1 ? mossaP1 : mossaP2) ?? casuale(true);
  const mossaParata = (attacker === 1 ? mossaP2 : mossaP1) ?? casuale(false);
  const shot = mossaAttacco.zone;
  const keeper = mossaParata.zone;
  return {
    shot,
    keeper,
    power: mossaAttacco.power,
    p1Choice: attacker === 1 ? shot : keeper,
    p2Choice: attacker === 1 ? keeper : shot,
  };
}

// ---------- Sessioni di gioco (memoria) ----------

export type EsitoDurata = 'ok' | 'troppo_presto' | 'scaduta';

/** La sessione e' valida solo se la partita e' durata un tempo plausibile. */
export function verificaDurata(trascorsoMs: number, minimoMs: number, massimoMs: number): EsitoDurata {
  if (!Number.isFinite(trascorsoMs) || trascorsoMs > massimoMs) return 'scaduta';
  if (trascorsoMs < minimoMs) return 'troppo_presto';
  return 'ok';
}

/** Una partita a memoria non dura piu' di cosi'. */
export const SESSIONE_MINIGIOCO_MAX_MS = 10 * 60 * 1000;

/**
 * Memoria: secondi minimi per chiudere ogni livello, uno per coppia (4, 6 e 8
 * coppie). Ogni coppia sono due tocchi e un'animazione: e' un limite largo,
 * serve a fermare chi dichiara un livello senza averlo giocato.
 */
export const MEMORIA_SECONDI_MINIMI: readonly number[] = [4, 6, 8];

/** Margine per rete e arrotondamenti del timer del client. */
export const MEMORIA_TOLLERANZA_S = 3;

export type EsitoMemoria =
  | { ok: true; levelsCompleted: number; timeRemaining: number }
  | { ok: false; motivo: 'nessun_livello' | 'troppo_veloce' };

/**
 * Risultato della memoria vincolato a cio' che e' fisicamente possibile:
 * - livelli tra 0 e quelli esistenti;
 * - tempo residuo mai oltre il tempo dei livelli meno il minimo per giocarli;
 * - il tempo giocato dichiarato (livelli chiusi, piu' l'intero timer del
 *   livello perso se la partita non e' finita) non puo' superare il tempo
 *   trascorso davvero dall'avvio della sessione sul server.
 */
export function valutaMemoria(
  livelliDichiarati: unknown,
  tempoResiduoDichiarato: unknown,
  trascorsoMs: number
): EsitoMemoria {
  const tempi = COINS.memoriaLevelTimes;
  const levelsCompleted = intInRange(livelliDichiarati, 0, tempi.length);
  if (levelsCompleted < 1) return { ok: false, motivo: 'nessun_livello' };

  const somma = (a: readonly number[]) => a.slice(0, levelsCompleted).reduce((x, y) => x + y, 0);
  const tempoLivelli = somma(tempi);
  const minimoLivelli = somma(MEMORIA_SECONDI_MINIMI);
  const timeRemaining = intInRange(tempoResiduoDichiarato, 0, Math.max(0, tempoLivelli - minimoLivelli));

  const livelloPerso = levelsCompleted < tempi.length ? tempi[levelsCompleted] : 0;
  const giocatoDichiarato = tempoLivelli - timeRemaining + livelloPerso;
  if (trascorsoMs / 1000 + MEMORIA_TOLLERANZA_S < giocatoDichiarato) {
    return { ok: false, motivo: 'troppo_veloce' };
  }
  return { ok: true, levelsCompleted, timeRemaining };
}

// ---------- Quiz ----------

/** Secondi per domanda nel client (QuizCalcioPage), piu' la pausa tra due domande. */
const QUIZ_SECONDI_PER_DOMANDA = 15 + 1;
/** Margine per caricamento e rete. */
const QUIZ_MARGINE_MS = 30_000;

/** Oltre questo tempo dall'avvio le risposte non valgono piu' nulla. */
export const QUIZ_DURATA_MAX_MS = COINS.quizMaxQuestions * QUIZ_SECONDI_PER_DOMANDA * 1000 + QUIZ_MARGINE_MS;

export function quizScaduto(avviatoMs: number, oraMs: number): boolean {
  if (!Number.isFinite(avviatoMs)) return true;
  return oraMs - avviatoMs > QUIZ_DURATA_MAX_MS;
}
