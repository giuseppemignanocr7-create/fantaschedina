// ============================================
// MERCATI — etichette leggibili di tipo giocata ed esito.
//
// Le stringhe stavano dentro PronosticiPage, l'unico posto che compilava una
// schedina. Ora anche la pagina di una lega mostra i pronostici giocati, e
// due copie delle stesse etichette si sarebbero disallineate alla prima
// modifica.
// ============================================

import type { BetType, Match } from '@/types';
import type { MatchOdds } from '@/data/mockData';

/**
 * Solo le quote delle partite non ancora iniziate: sono quelle che il server
 * conta per decidere quanti pronostici servono (vedi pickRichieste).
 * `now` = 0 (orologio non ancora letto) tiene tutte le partite in programma.
 */
export function quoteAncoraAperte(
  matches: Pick<Match, 'id' | 'status' | 'scheduledAt'>[] | undefined,
  odds: Record<string, MatchOdds>,
  now: number
): Record<string, MatchOdds> {
  const aperte: Record<string, MatchOdds> = {};
  for (const m of matches ?? []) {
    if (m.status !== 'scheduled') continue;
    if (new Date(m.scheduledAt).getTime() <= now) continue;
    if (odds[m.id]) aperte[m.id] = odds[m.id];
  }
  return aperte;
}

/**
 * Quota sotto la quale il server rifiuta la giocata. Specchio di
 * `TOURNAMENT.penaltyOddsMin` in functions/src/config.ts: vanno cambiate insieme.
 */
export const QUOTA_MINIMA = 1.25;

/**
 * Quota del bookmaker per un esito, se si puo' giocare: null quando il mercato
 * o l'esito non sono quotati, o quando la quota e' sotto il minimo ammesso.
 * Mai una quota calcolata o di ripiego.
 */
export function quotaGiocabile(
  odds: MatchOdds | undefined,
  betType: string,
  outcome: string
): number | null {
  const mercato = (odds as Record<string, Record<string, number> | undefined> | undefined)?.[betType];
  const quota = mercato?.[outcome];
  if (typeof quota !== 'number' || !Number.isFinite(quota)) return null;
  return quota >= QUOTA_MINIMA - 1e-9 ? quota : null;
}

/** Nome breve del mercato, quello che sta in un chip. */
export const BET_TYPE_SHORT: Record<string, string> = {
  esito: '1X2',
  over_under: 'O/U',
  goal_nogoal: 'GG',
  doppia_chance: 'DC',
  multigoal: 'MG',
  esito_1t: '1T',
  over_under_1t: 'O/U 1T',
  goal_nogoal_1t: 'GG 1T',
};

/** Nome esteso del mercato. */
export const BET_TYPE_LABEL: Record<string, string> = {
  esito: 'Esito Finale',
  over_under: 'Over/Under 2.5',
  goal_nogoal: 'Goal / NoGoal',
  doppia_chance: 'Doppia Chance',
  multigoal: 'Multigoal',
  esito_1t: 'Esito 1° Tempo',
  over_under_1t: 'O/U 1° Tempo',
  goal_nogoal_1t: 'GG/NG 1° Tempo',
};

/** L'esito scelto, scritto come lo legge un giocatore. */
export function outcomeLabel(betType: BetType | string, outcome: string): string {
  switch (betType) {
    case 'over_under':
      return outcome === 'OVER' ? 'Over 2.5' : 'Under 2.5';
    case 'over_under_1t':
      return outcome === 'OVER' ? 'Over 1.5' : 'Under 1.5';
    case 'goal_nogoal':
    case 'goal_nogoal_1t':
      return outcome === 'GG' ? 'Goal Goal' : 'No Goal';
    case 'multigoal':
      return `${outcome.startsWith('O') ? 'Over' : 'Under'} ${outcome.slice(1)}`;
    default:
      return outcome;
  }
}

/** Mercato + esito in una riga sola: "O/U · Over 2.5". */
export function betLabel(betType: BetType | string, outcome: string): string {
  const mercato = BET_TYPE_SHORT[betType] ?? betType;
  return `${mercato} · ${outcomeLabel(betType, outcome)}`;
}
