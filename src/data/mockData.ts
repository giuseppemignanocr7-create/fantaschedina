// ============================================
// FANTA SCHEDINA - TIPI DELLE QUOTE
// Qui c'erano squadre, partite e classifiche di esempio: non le usava piu'
// nessuno e sono state tolte. Resta il tipo delle quote, usato ovunque.
// ============================================

/**
 * Quote di una partita. Ogni mercato e' facoltativo perche' le quote arrivano
 * solo dal bookmaker: quelli che non pubblica non esistono e non si giocano.
 * Speculare a functions/src/odds.ts.
 */
export interface MatchOdds {
  esito?: { '1': number; 'X': number; '2': number };
  over_under?: { 'OVER': number; 'UNDER': number };
  goal_nogoal?: { 'GG': number; 'NG': number };
  doppia_chance?: { '1X': number; '12': number; 'X2': number };
  multigoal?: Record<string, number>;
  esito_1t?: { '1': number; 'X': number; '2': number };
  over_under_1t?: { 'OVER': number; 'UNDER': number };
  /** Nessuna agenzia lo pubblica: resta per le schedine gia' giocate. */
  goal_nogoal_1t?: { 'GG': number; 'NG': number };
}
