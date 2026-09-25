import { MAX_PICKS_PER_SCHEDINA } from './economy';
import type { MatchOdds } from '../data/mockData';
/** Pronostici richiesti: dieci, o meno se l'agenzia ha quotato meno partite. */
export function pickRichieste(quotate: Record<string, MatchOdds> | undefined): number {
  const n = Object.values(quotate ?? {}).filter(o => !!o?.esito).length;
  return Math.min(MAX_PICKS_PER_SCHEDINA, n);
}
