// ============================================
// FANTASCHEDINA FUNCTIONS - SCORING
// Valutazione multi-mercato (1X2, O/U, GG/NG, DC, multigoal, 1° tempo)
// + calcolo punteggio schedina + power-up.
// ============================================

import { TOURNAMENT, PowerUpSelection } from './config';

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  outcome: '1' | 'X' | '2';
  htHomeGoals?: number;
  htAwayGoals?: number;
}

export interface Prediction {
  matchId: string;
  betType: string;
  outcome: string;
  odds: number;
}

export interface PredictionResult extends Prediction {
  isCorrect: boolean;
  isVoid: boolean;
  pointsEarned: number;
}

export interface SchedinaScore {
  totalPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  finalPoints: number;
  correctPredictions: number;
  predictionResults: PredictionResult[];
}

function outcomeOf(h: number, a: number): '1' | 'X' | '2' {
  return h > a ? '1' : a > h ? '2' : 'X';
}

/**
 * Valuta un pronostico contro il risultato.
 * Ritorna true/false, oppure null se il mercato non è valutabile
 * (es. mercati 1° tempo senza dato HT disponibile → void).
 */
export function evaluateBet(
  betType: string,
  outcome: string,
  r: MatchResult
): boolean | null {
  const total = r.homeGoals + r.awayGoals;
  switch (betType) {
    case 'esito':
      return outcome === r.outcome;
    case 'over_under':
      return outcome === 'OVER' ? total >= 3 : total <= 2;
    case 'goal_nogoal': {
      const gg = r.homeGoals > 0 && r.awayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    case 'doppia_chance':
      return outcome.includes(r.outcome);
    case 'multigoal': {
      const line = parseFloat(outcome.slice(1));
      if (Number.isNaN(line)) return null;
      return outcome.startsWith('O') ? total > line : total < line;
    }
    case 'esito_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      return outcome === outcomeOf(r.htHomeGoals, r.htAwayGoals);
    }
    case 'over_under_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      const ht = r.htHomeGoals + r.htAwayGoals;
      return outcome === 'OVER' ? ht >= 2 : ht <= 1; // linea 1.5
    }
    case 'goal_nogoal_1t': {
      if (r.htHomeGoals == null || r.htAwayGoals == null) return null;
      const gg = r.htHomeGoals > 0 && r.htAwayGoals > 0;
      return outcome === 'GG' ? gg : !gg;
    }
    default:
      return null;
  }
}

/**
 * Punti di una singola giocata vinta: la quota (cappata a oddsCap)
 * moltiplicata per 10. Una giocata a 2.00 vale 20 punti, una a 5.00 o più ne
 * vale 50. I punti della schedina sono la somma di questi contributi.
 */
export function calculateBetPoints(odds: number, isCorrect: boolean): number {
  if (!isCorrect) return 0;
  return Math.min(odds, TOURNAMENT.oddsCap) * TOURNAMENT.pointsMultiplier;
}

/**
 * Bonus raggiunto con `corretti` pronostici esatti su `richieste`:
 * - 'pieno' (+10 punti) se sono tutti esatti;
 * - 'quasi' (+5 punti) se ne manca uno solo, ma solo con almeno 9 richiesti:
 *   su una schedina corta "tutti meno uno" non e' un'impresa.
 * Si contano solo gli esatti veri: un pronostico annullato non aiuta mai.
 */
export function livelloBonus(corretti: number, richieste: number): 'pieno' | 'quasi' | null {
  if (richieste <= 0) return null;
  if (corretti >= richieste) return 'pieno';
  if (richieste >= 9 && corretti === richieste - 1) return 'quasi';
  return null;
}

/**
 * Stati con cui una partita non si gioca piu': i pronostici sopra sono
 * annullati. Accetta le grafie che usano i fornitori (ESPN scrive "canceled").
 */
const STATI_ANNULLATI = new Set(['postponed', 'canceled', 'cancelled', 'abandoned']);

export function partitaAnnullata(status: string | undefined | null): boolean {
  return STATI_ANNULLATI.has(String(status ?? '').toLowerCase());
}

/** Mercati di primo tempo: senza il parziale non si possono valutare. */
export function mercatoPrimoTempo(betType: string): boolean {
  return betType.endsWith('_1t');
}

/**
 * Ore dopo il fischio d'inizio oltre le quali non si aspetta piu': una partita
 * non finita viene annullata, un parziale di primo tempo mancante pure.
 * 50 ore dal calcio d'inizio sono circa 48 dalla fine della partita.
 */
export const ORE_ATTESA_RISULTATO = 50;

export interface PartitaDaValutare {
  id: string;
  status: string;
  kickoffMs: number;
  result?: MatchResult;
  /** true se il fornitore dei risultati ha risposto per questa partita. */
  confermata: boolean;
}

export interface StatoGiornata {
  /** Risultati con cui valutare: le partite annullate non ci sono. */
  risultati: Map<string, MatchResult>;
  /** Partite annullate: i pronostici sopra non contano. */
  annullate: string[];
  /** Partite non ancora chiuse: finche' ce ne sono la giornata aspetta. */
  inAttesa: string[];
  /** Partite finite di cui manca ancora il parziale di primo tempo. */
  senzaParziale: string[];
}

/**
 * Stato delle partite di una giornata al momento della valutazione.
 *
 * - finita con risultato: si valuta; se manca il parziale e non sono passate
 *   ORE_ATTESA_RISULTATO ore finisce in `senzaParziale` (chi ci ha giocato un
 *   mercato di primo tempo aspetta il giro successivo), dopo si valuta senza
 *   e i mercati di primo tempo sono annullati;
 * - rinviata, cancellata o abbandonata: annullata;
 * - non finita da oltre ORE_ATTESA_RISULTATO ore (il fornitore lo conferma,
 *   o tace da una settimana): annullata;
 * - altrimenti in attesa.
 *
 * `forza` (valutazione chiesta dall'admin) annulla subito cio' che non e'
 * finito e non aspetta i parziali: nessun risultato viene inventato.
 */
export function statoGiornata(
  partite: PartitaDaValutare[],
  nowMs: number,
  forza = false
): StatoGiornata {
  const risultati = new Map<string, MatchResult>();
  const annullate: string[] = [];
  const inAttesa: string[] = [];
  const senzaParziale: string[] = [];
  const attesaMs = ORE_ATTESA_RISULTATO * 60 * 60 * 1000;
  for (const p of partite) {
    const scaduta = nowMs > p.kickoffMs + attesaMs;
    if (partitaAnnullata(p.status)) {
      annullate.push(p.id);
    } else if (p.status === 'finished' && p.result) {
      risultati.set(p.id, p.result);
      const parziale = p.result.htHomeGoals != null && p.result.htAwayGoals != null;
      if (!parziale && !scaduta && !forza) senzaParziale.push(p.id);
    } else if (forza || (scaduta && p.confermata) || nowMs > p.kickoffMs + 7 * 24 * 60 * 60 * 1000) {
      annullate.push(p.id);
    } else {
      inAttesa.push(p.id);
    }
  }
  return { risultati, annullate, inAttesa, senzaParziale };
}

/** true se la schedina ha un mercato di primo tempo su una partita senza parziale. */
export function attendeParziale(predictions: Prediction[], senzaParziale: Iterable<string>): boolean {
  const ids = new Set(senzaParziale);
  if (ids.size === 0) return false;
  return predictions.some(p => ids.has(p.matchId) && mercatoPrimoTempo(p.betType));
}

/**
 * Valuta una schedina completa contro i risultati.
 * - punti base = somma delle quote (cappate) × 10 delle giocate corrette
 * - void (partita annullata, senza risultato o mercato non valutabile) =
 *   0 punti e NON corretto: non aiuta mai a raggiungere un bonus
 * - bonus: +10 con tutti i richiesti esatti, +5 con uno in meno (vedi
 *   livelloBonus); `richieste` sono i pronostici che la schedina doveva
 *   avere, di norma quanti ne ha
 * - jolly power-up: raddoppia il contributo della giocata selezionata (se vinta)
 * - shield: annulla il moltiplicatore di penalità quote basse
 * - insurance: con due esatti in meno del pieno dà comunque il +5 (8/10)
 * Bonus e penalità restano espressi come impatto assoluto in punti, così
 * finalPoints resta sempre totalPoints + bonusPoints + penaltyPoints.
 */
export function evaluateSchedina(
  predictions: Prediction[],
  results: Map<string, MatchResult>,
  powerups: PowerUpSelection = {},
  richieste: number = predictions.length
): SchedinaScore {
  const predictionResults: PredictionResult[] = predictions.map(pred => {
    const r = results.get(pred.matchId);
    if (!r) {
      return { ...pred, isCorrect: false, isVoid: true, pointsEarned: 0 };
    }
    const evalResult = evaluateBet(pred.betType, pred.outcome, r);
    if (evalResult === null) {
      // Mercato non valutabile → annullato: zero punti e non conta come
      // esatto. Prima contava come esatto, e un mercato inventato dal client
      // (o un parziale mancante) regalava la strada verso il bonus pieno.
      return { ...pred, isCorrect: false, isVoid: true, pointsEarned: 0 };
    }
    let points = calculateBetPoints(pred.odds, evalResult);
    if (evalResult && powerups.jolly === pred.matchId) {
      points *= 2;
    }
    return {
      ...pred,
      isCorrect: evalResult,
      isVoid: false,
      pointsEarned: Math.round(points * 100) / 100,
    };
  });

  const correctPredictions = predictionResults.filter(p => p.isCorrect).length;
  // Punti della schedina: somma delle quote indovinate (ognuna cappata a
  // oddsCap, raddoppiata dal Jolly). Fino al 20/08/2026 si moltiplicavano:
  // dieci quote da 2.00 valevano 1024 punti invece di 20, e una sola giocata
  // sbagliata azzerava tutto.
  const puntiBase = predictionResults.reduce(
    (somma, p) => (p.isCorrect ? somma + p.pointsEarned : somma),
    0
  );

  // Bonus pieno e "tutti meno uno": punti pieni aggiunti in fondo, non
  // moltiplicatori (insurance: con due esatti in meno si prende comunque il +5).
  let bonusPunti = 0;
  const livello = livelloBonus(correctPredictions, richieste);
  if (livello === 'pieno') bonusPunti = TOURNAMENT.bonus10Points;
  else if (livello === 'quasi') bonusPunti = TOURNAMENT.bonus9Points;
  else if (powerups.insurance && richieste >= 9 && correctPredictions === richieste - 2) {
    bonusPunti = TOURNAMENT.bonus9Points;
  }

  // Penalità quote 1.25-1.29 (composizione della schedina, a prescindere
  // dall'esito), ogni 3 giocate → ×0.9, annullata dallo shield
  const penaltyRange = predictions.filter(
    p => p.odds >= TOURNAMENT.penaltyOddsMin - 0.001 && p.odds < TOURNAMENT.minValidOdds
  ).length;
  let penaltyMultiplier = Math.pow(TOURNAMENT.penaltyMultiplierPerThree, Math.floor(penaltyRange / 3));
  if (powerups.shield) penaltyMultiplier = 1;

  // La penalità colpisce la composizione della schedina, quindi si applica ai
  // punti delle giocate; il bonus premia la precisione e si somma in fondo,
  // senza essere eroso dalla penalità.
  const totalPoints = Math.round(puntiBase * 100) / 100;
  const afterPenalty = Math.round(totalPoints * penaltyMultiplier * 100) / 100;
  const penaltyPoints = Math.round((afterPenalty - totalPoints) * 100) / 100;
  const bonusPoints = bonusPunti;

  return {
    totalPoints,
    bonusPoints,
    penaltyPoints,
    finalPoints: Math.round((afterPenalty + bonusPoints) * 100) / 100,
    correctPredictions,
    predictionResults,
  };
}
