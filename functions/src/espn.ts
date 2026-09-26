// ============================================
// FANTASCHEDINA FUNCTIONS - ESPN CLIENT (server-side)
// Fetch pool multi-campionato + risultati (incl. parziale 1Â° tempo dai linescores).
// ============================================

import { fetchJson } from './http';
import type { StatoPartita } from './palinsesto';

const ESPN_BASE = (slug: string) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}`;

const ESPN_TO_ID: Record<string, string> = {
  INT: 'int', MIL: 'mil', JUV: 'juv', NAP: 'nap', ATA: 'ata',
  LAZ: 'laz', ROMA: 'rom', ROM: 'rom', FIO: 'fio', BOL: 'bol',
  TOR: 'tor', UDI: 'udi', EMP: 'emp', GEN: 'gen', CAG: 'cag',
  VER: 'ver', HEL: 'ver', PAR: 'par', COMO: 'com', COM: 'com',
  MON: 'mon', VEN: 'ven', LEC: 'lec', SAS: 'sas', CRE: 'cre',
  SAL: 'sal', PIS: 'pis',
};

/** ESPN scrive il punteggio di un tempo ora come numero ora come stringa. */
export interface ESPNLinescore {
  value?: number;
  displayValue?: string;
}

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  linescores?: ESPNLinescore[];
  team: { abbreviation: string; displayName: string; logo?: string };
}

interface ESPNSummary {
  header?: {
    competitions?: Array<{ competitors?: ESPNCompetitor[] }>;
  };
}

/**
 * Gol segnati nel primo tempo, da `linescores[0]`: sono i gol per tempo, non
 * cumulativi (verificato il 21/09/2026: Bologna-Torino 1-1 arriva come
 * [1,0] e [0,1]). Accetta sia `value` sia `displayValue` perche' ESPN usa
 * l'uno o l'altro a seconda dell'endpoint.
 */
export function golPrimoTempo(linescores: ESPNLinescore[] | undefined): number | null {
  const primo = linescores?.[0];
  if (!primo) return null;
  if (typeof primo.value === 'number' && Number.isFinite(primo.value)) return primo.value;
  const n = Number.parseInt(primo.displayValue ?? '', 10);
  return Number.isFinite(n) ? n : null;
}

/** Stato di un evento come lo scrive ESPN (`name` es. "STATUS_POSTPONED"). */
export interface ESPNStatusType {
  state?: 'pre' | 'in' | 'post' | string;
  completed?: boolean;
  name?: string;
}

interface ESPNEvent {
  id: string;
  date: string;
  competitions: Array<{
    status: { type: ESPNStatusType };
    competitors: ESPNCompetitor[];
  }>;
}

/**
 * Traduce lo stato ESPN in quello salvato sulla giornata. Rinvii,
 * cancellazioni e sospensioni definitive arrivano come `state: 'post'` non
 * completato: prima diventavano 'scheduled' e la partita restava in attesa
 * per sempre, bloccando la valutazione della giornata. Ora si riconoscono dal
 * nome dello stato e si salvano come 'postponed' / 'canceled' / 'abandoned'.
 */
export function statoEspn(t: ESPNStatusType | undefined): StatoPartita {
  const nome = (t?.name ?? '').toUpperCase();
  if (nome.includes('POSTPONED')) return 'postponed';
  if (nome.includes('CANCELED') || nome.includes('CANCELLED')) return 'canceled';
  if (nome.includes('ABANDONED')) return 'abandoned';
  if (t?.state === 'post') return t.completed ? 'finished' : 'scheduled';
  if (t?.state === 'in') return 'live';
  return 'scheduled';
}

/** Giorno nel formato di ESPN (YYYYMMDD, UTC). */
function giornoEspn(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Intervallo di giorni per il parametro `dates` di ESPN
 * (`YYYYMMDD-YYYYMMDD`), dal primo all'ultimo orario, allargato di
 * `margineGiorni` per lato: una sola richiesta copre tutta la giornata invece
 * di una per giorno, e il margine assorbe il fuso (ESPN ragiona in ora
 * americana, gli orari salvati sono UTC).
 */
export function intervalloDate(date: Date[], margineGiorni = 0): string | null {
  const tempi = date.map(d => d.getTime()).filter(t => Number.isFinite(t));
  if (tempi.length === 0) return null;
  const giorno = 24 * 60 * 60 * 1000;
  const inizio = new Date(Math.min(...tempi) - margineGiorni * giorno);
  const fine = new Date(Math.max(...tempi) + margineGiorni * giorno);
  const a = giornoEspn(inizio);
  const b = giornoEspn(fine);
  return a === b ? a : `${a}-${b}`;
}

interface ESPNScoreboard {
  leagues: Array<{ season: { startDate: string }; calendar: string[] }>;
  events: ESPNEvent[];
}

export interface EspnMatch {
  id: string;
  competition: string;
  homeTeam: { id: string; name: string; shortName: string; logo?: string };
  awayTeam: { id: string; name: string; shortName: string; logo?: string };
  scheduledAt: Date;
  status: StatoPartita;
}

export interface EspnResult {
  homeGoals: number;
  awayGoals: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
  status: StatoPartita;
  /** Orario attuale secondo ESPN: cambia quando la partita viene spostata. */
  scheduledAt?: Date;
}

async function fetchScoreboard(slug: string, dateStr?: string): Promise<ESPNScoreboard | null> {
  // Con un intervallo di piu' giorni gli eventi sono molti di piu' che in un
  // giorno solo: il limite deve starci largo.
  const url = dateStr
    ? `${ESPN_BASE(slug)}/scoreboard?dates=${dateStr}&limit=200`
    : `${ESPN_BASE(slug)}/scoreboard?limit=50`;
  return fetchJson<ESPNScoreboard>(url, { label: `espn:${slug}` });
}

function teamOf(c: ESPNCompetitor) {
  return {
    id:
      ESPN_TO_ID[c.team.abbreviation] ??
      c.team.abbreviation.toLowerCase().slice(0, 3),
    name: c.team.displayName,
    shortName: c.team.abbreviation,
    ...(c.team.logo ? { logo: c.team.logo } : {}),
  };
}

/** Prossimo blocco di partite per UN campionato: entro 5 giorni dalla prima futura. */
async function fetchNextMatchdayForCompetition(
  code: string,
  slug: string
): Promise<{ matches: EspnMatch[]; seasonStart: Date; season: string } | null> {
  const base = await fetchScoreboard(slug);
  if (!base) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = (base.leagues[0]?.calendar ?? [])
    .map(d => new Date(d))
    .filter(d => d.getTime() >= todayStart.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  if (upcoming.length === 0) return null;

  const first = upcoming[0];
  const block = upcoming.filter(
    d => d.getTime() - first.getTime() < 5 * 24 * 60 * 60 * 1000
  );

  // Una sola richiesta per tutto il blocco (dates=YYYYMMDD-YYYYMMDD) invece
  // di una per giorno.
  const intervallo = intervalloDate(block.slice(0, 5));
  const boards = intervallo ? [await fetchScoreboard(slug, intervallo)] : [];

  const matches: EspnMatch[] = [];
  const visti = new Set<string>();
  for (const day of boards) {
    for (const ev of day?.events ?? []) {
      const comp = ev.competitions[0];
      if (!comp) continue;
      // Nel pool solo partite da giocare o in corso: rinviate e cancellate
      // non si aggiungono (quelle gia' in giornata le aggiorna la sync).
      const status = statoEspn(comp.status?.type);
      if (status !== 'scheduled' && status !== 'live') continue;
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      const id = `espn-${ev.id}`;
      if (visti.has(id)) continue;
      visti.add(id);
      matches.push({
        id,
        competition: code,
        homeTeam: teamOf(home),
        awayTeam: teamOf(away),
        scheduledAt: new Date(ev.date),
        status,
      });
    }
  }

  if (matches.length === 0) return null;

  const seasonStart = new Date(
    base.leagues[0]?.season?.startDate ?? base.leagues[0]?.calendar?.[0] ?? Date.now()
  );
  return {
    matches,
    seasonStart,
    season: `${seasonStart.getUTCFullYear()}-${seasonStart.getUTCFullYear() + 1}`,
  };
}

/**
 * Pool di partite pescate da TUTTI i campionati attivi (scelti dall'admin).
 * Ogni utente scieglie liberamente fino a MAX_PICKS_PER_SCHEDINA partite dal pool.
 */
export async function fetchActiveMatchdayPool(
  competitions: { code: string; slug: string }[]
): Promise<{
  matches: EspnMatch[];
  deadline: Date;
  seasonStart: Date;
  season: string;
} | null> {
  const results = await Promise.all(
    competitions.map(c => fetchNextMatchdayForCompetition(c.code, c.slug))
  );

  const matches: EspnMatch[] = [];
  let seasonStart: Date | null = null;
  let season = '';
  for (const r of results) {
    if (!r) continue;
    matches.push(...r.matches);
    if (!seasonStart || r.seasonStart < seasonStart) {
      seasonStart = r.seasonStart;
      season = r.season;
    }
  }

  // Basta una partita: la giornata si pubblica con quelle quotate, e le
  // partite da scegliere diventano min(10, quotate). Prima sotto le cinque
  // partite il pool si scartava del tutto.
  if (matches.length === 0) return null;

  matches.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const earliest = matches[0].scheduledAt.getTime();

  return {
    matches: matches.slice(0, 80),
    deadline: new Date(earliest - 2 * 60 * 60 * 1000),
    seasonStart: seasonStart ?? new Date(),
    season,
  };
}

/** Partita di cui chiedere il risultato. */
export interface PartitaDaLeggere {
  id: string;
  scheduledAt: Date;
  competition: string;
  /**
   * Parziale di primo tempo gia' salvato: se c'e' non si richiede il summary
   * della partita (una chiamata in meno a ogni giro) e il risultato lo riporta
   * cosi' com'era.
   */
  ht?: { home: number; away: number };
}

/** Risultati per un set di partite multi-campionato (id interno = `espn-${eventId}`). */
export async function fetchResults(
  matches: PartitaDaLeggere[],
  opzioni: { parziali?: boolean } = {}
): Promise<Map<string, EspnResult>> {
  const out = new Map<string, EspnResult>();
  if (matches.length === 0) return out;

  // Una richiesta per campionato con l'intervallo di giorni che copre tutte le
  // sue partite (competition == slug ESPN, vedi COMPETITIONS in config.ts).
  // Il margine di un giorno per lato tiene dentro le partite serali che per
  // ESPN cadono gia' nel giorno dopo, e quelle spostate di poco.
  const perCampionato = new Map<string, Date[]>();
  for (const m of matches) {
    const date = perCampionato.get(m.competition) ?? [];
    date.push(m.scheduledAt);
    perCampionato.set(m.competition, date);
  }

  const wanted = new Set(matches.map(m => m.id));
  const boards = await Promise.all(
    [...perCampionato.entries()].map(([slug, date]) => {
      const intervallo = intervalloDate(date, 1);
      return intervallo ? fetchScoreboard(slug, intervallo) : Promise.resolve(null);
    })
  );

  for (const sb of boards) {
    for (const ev of sb?.events ?? []) {
      const internalId = `espn-${ev.id}`;
      if (!wanted.has(internalId)) continue;
      const comp = ev.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      const htHome = golPrimoTempo(home.linescores);
      const htAway = golPrimoTempo(away.linescores);
      const data = new Date(ev.date);
      out.set(internalId, {
        homeGoals: parseInt(home.score ?? '0', 10),
        awayGoals: parseInt(away.score ?? '0', 10),
        ...(htHome != null && htAway != null
          ? { htHomeGoals: htHome, htAwayGoals: htAway }
          : {}),
        status: statoEspn(comp.status?.type),
        ...(Number.isFinite(data.getTime()) ? { scheduledAt: data } : {}),
      });
    }
  }
  // Parziale gia' salvato sulla giornata: si riporta quello, senza chiedere
  // di nuovo il summary a ogni giro.
  for (const m of matches) {
    const r = out.get(m.id);
    if (m.ht && r && r.htHomeGoals == null) {
      out.set(m.id, { ...r, htHomeGoals: m.ht.home, htAwayGoals: m.ht.away });
    }
  }
  if (opzioni.parziali === false) return out;
  // Il parziale di primo tempo nello scoreboard non c'e' proprio (verificato il
  // 21/09/2026: il campo linescores manca del tutto), mentre il summary della
  // singola partita ce l'ha. Senza, i mercati di primo tempo non sono MAI
  // valutabili: valgono zero punti e contano come indovinati, cioe' il bonus
  // 10/10 garantito a chi li gioca. Si chiede solo per le partite finite che
  // non hanno gia' il parziale: al massimo una chiamata per partita.
  const senzaParziale = matches.filter(m => {
    const r = out.get(m.id);
    return r?.status === 'finished' && r.htHomeGoals == null;
  });
  await Promise.all(
    senzaParziale.map(async m => {
      const parziale = await fetchParziale(m.competition, m.id.replace(/^espn-/, ''));
      const r = out.get(m.id);
      if (!parziale || !r) return;
      out.set(m.id, { ...r, htHomeGoals: parziale.home, htAwayGoals: parziale.away });
    })
  );

  return out;
}

/** Parziale di primo tempo di una singola partita, dal summary ESPN. */
async function fetchParziale(
  slug: string,
  eventId: string
): Promise<{ home: number; away: number } | null> {
  const summary = await fetchJson<ESPNSummary>(
    `${ESPN_BASE(slug)}/summary?event=${eventId}`,
    { label: `espn:summary:${eventId}` }
  );
  const competitors = summary?.header?.competitions?.[0]?.competitors ?? [];
  const home = golPrimoTempo(competitors.find(c => c.homeAway === 'home')?.linescores);
  const away = golPrimoTempo(competitors.find(c => c.homeAway === 'away')?.linescores);
  return home != null && away != null ? { home, away } : null;
}
