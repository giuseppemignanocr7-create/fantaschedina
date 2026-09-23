// ============================================
// FANTASCHEDINA FUNCTIONS - FORMA DELLE QUOTE
//
// Qui c'e' solo la forma dei mercati. Fino al 23/09/2026 questo file conteneva
// anche un motore di calcolo alla Poisson che riempiva i mercati che il
// fornitore non pubblicava: il risultato erano quote che nessun bookmaker
// avrebbe mai esposto, mescolate a quelle vere senza che si distinguessero.
// Ora le quote arrivano soltanto dal fornitore (realOdds.ts) e i mercati che
// non ha semplicemente non si giocano, quindi ogni campo e' facoltativo.
// ============================================

export interface MatchOdds {
  esito?: { '1': number; X: number; '2': number };
  over_under?: { OVER: number; UNDER: number };
  goal_nogoal?: { GG: number; NG: number };
  doppia_chance?: { '1X': number; '12': number; X2: number };
  multigoal?: Record<string, number>;
  esito_1t?: { '1': number; X: number; '2': number };
  over_under_1t?: { OVER: number; UNDER: number };
  /**
   * Nessuna agenzia pubblica il GG/NG di primo tempo: il campo resta per le
   * schedine gia' giocate, non e' piu' un mercato offerto.
   */
  goal_nogoal_1t?: { GG: number; NG: number };
}
