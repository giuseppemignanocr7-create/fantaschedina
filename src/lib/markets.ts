// ============================================
// MERCATI — etichette leggibili di tipo giocata ed esito.
//
// Le stringhe stavano dentro PronosticiPage, l'unico posto che compilava una
// schedina. Ora anche la pagina di una lega mostra i pronostici giocati, e
// due copie delle stesse etichette si sarebbero disallineate alla prima
// modifica.
// ============================================

import type { BetType } from '@/types';

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
