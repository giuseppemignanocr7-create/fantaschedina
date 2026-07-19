// ============================================
// FANTA SCHEDINA - FOOTBALL DATA SERVICE
// ESPN public API — nessuna chiave richiesta
// https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1
// ============================================

import type { Match, MatchOutcome } from '@/types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

// ESPN abbreviation → id interno (forza squadra in oddsEngine)
// Squadre attuali Serie A 25/26 + alcune presenti in stagioni recenti.
const ESPN_TO_ID: Record<string, string> = {
  INT: 'int',
  MIL: 'mil', 'AC Milan': 'mil',
  JUV: 'juv',
  NAP: 'nap',
  ATA: 'ata',
  LAZ: 'laz',
  ROMA: 'rom', ROM: 'rom',
  FIO: 'fio',
  BOL: 'bol',
  TOR: 'tor',
  UDI: 'udi',
  EMP: 'emp',
  GEN: 'gen',
  CAG: 'cag',
  VER: 'ver', HEL: 'ver',
  PAR: 'par',
  COMO: 'com', COM: 'com',
  MON: 'mon',
  VEN: 'ven',
  LEC: 'lec',
  // Promosse / retrocesse usate come fallback con id propri (non in TEAM_STRENGTH → forza media)
  SAS: 'sas',
  CRE: 'cre',
  SAL: 'sal',
  PIS: 'pis',
};

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  linescores?: { value: number }[];
  team: {
    abbreviation: string;
    displayName: string;
    logo?: string;
  };
}

interface ESPNEvent {
  id: string;
  date: string;
  competitions: Array<{
    status: {
      clock?: number;
      displayClock?: string;
      period?: number;
      type: { state: 'pre' | 'in' | 'post'; completed: boolean };
    };
    competitors: ESPNCompetitor[];
  }>;
}

/** Snapshot live/finale di una partita (dati reali ESPN). */
export interface LiveScore {
  homeGoals: number;
  awayGoals: number;
  status: Match['status'];
  outcome: MatchOutcome;
  /** Minuto di gioco (solo se live). */
  displayClock?: string;
  /** 1 = primo tempo, 2 = secondo tempo. */
  period?: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
}

interface ESPNScoreboard {
  leagues: Array<{
    season: { startDate: string };
    calendar: string[];
  }>;
  events: ESPNEvent[];
}

export interface ApiMatchday {
  number: number;
  season: string;
  matches: Match[];
  deadline: Date;
}

async function fetchESPN(dateStr?: string): Promise<ESPNScoreboard | null> {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=20`
      : `${ESPN_BASE}/scoreboard?limit=20`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<ESPNScoreboard>;
  } catch {
    return null;
  }
}

function toMatch(ev: ESPNEvent, matchdayNum: number): Match | null {
  const comp = ev.competitions[0];
  if (!comp) return null;
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const state = comp.status.type.state;
  const hScore = parseInt(home.score ?? '0', 10);
  const aScore = parseInt(away.score ?? '0', 10);
  return {
    id: `espn-${ev.id}`,
    matchday: matchdayNum,
    competition: 'ita.1',
    homeTeam: {
      id: ESPN_TO_ID[home.team.abbreviation] ?? home.team.abbreviation.toLowerCase().slice(0, 3),
      name: home.team.displayName,
      shortName: home.team.abbreviation,
      logo: home.team.logo,
    },
    awayTeam: {
      id: ESPN_TO_ID[away.team.abbreviation] ?? away.team.abbreviation.toLowerCase().slice(0, 3),
      name: away.team.displayName,
      shortName: away.team.abbreviation,
      logo: away.team.logo,
    },
    scheduledAt: new Date(ev.date),
    status: state === 'post' ? 'finished' : state === 'in' ? 'live' : 'scheduled',
    ...(state === 'post' && comp.status.type.completed
      ? { result: { homeGoals: hScore, awayGoals: aScore, outcome: hScore > aScore ? '1' as const : aScore > hScore ? '2' as const : 'X' as const } }
      : {}),
  };
}

/**
 * Recupera i risultati per un set di partite già scheduled.
 * Chiama ESPN per ogni giorno coperto dalle partite e mappa per id ESPN.
 */
export async function fetchMatchResults(
  matches: Match[]
): Promise<Map<string, LiveScore>> {
  const out = new Map<string, LiveScore>();
  if (matches.length === 0) return out;

  // raccogli date uniche YYYYMMDD
  const days = new Set<string>();
  for (const m of matches) {
    const d = new Date(m.scheduledAt);
    days.add(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  // Map ESPN event id -> match id interno (id = `espn-${eventId}`)
  const boards = await Promise.all([...days].map(day => fetchESPN(day)));
  for (const sb of boards) {
    if (!sb?.events) continue;
    for (const ev of sb.events) {
      const internalId = `espn-${ev.id}`;
      const found = matches.find(m => m.id === internalId);
      if (!found) continue;
      const comp = ev.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      const state = comp.status.type.state;
      const status: Match['status'] =
        state === 'post' && comp.status.type.completed
          ? 'finished'
          : state === 'in'
          ? 'live'
          : 'scheduled';
      const homeGoals = parseInt(home.score ?? '0', 10);
      const awayGoals = parseInt(away.score ?? '0', 10);
      const htHome = home.linescores?.[0]?.value;
      const htAway = away.linescores?.[0]?.value;
      out.set(internalId, {
        homeGoals,
        awayGoals,
        status,
        outcome: homeGoals > awayGoals ? '1' : awayGoals > homeGoals ? '2' : 'X',
        ...(comp.status.displayClock ? { displayClock: comp.status.displayClock } : {}),
        ...(comp.status.period != null ? { period: comp.status.period } : {}),
        ...(htHome != null && htAway != null
          ? { htHomeGoals: htHome, htAwayGoals: htAway }
          : {}),
      });
    }
  }
  return out;
}

export async function fetchNextMatchday(): Promise<ApiMatchday | null> {
  try {
    // 1. Fetch today to get the full season calendar (no key needed)
    const base = await fetchESPN();
    if (!base) return null;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 2. Find upcoming dates in the calendar
    const upcoming = (base.leagues[0]?.calendar ?? [])
      .map(d => new Date(d))
      .filter(d => d.getTime() >= todayStart.getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    if (upcoming.length === 0) return null;

    // 3. Group dates within 5 days of the first one (= one matchday block)
    const first = upcoming[0];
    const block = upcoming.filter(d => d.getTime() - first.getTime() < 5 * 24 * 60 * 60 * 1000);

    // 4. Fetch each day in the block (in parallelo) and collect scheduled/live matches
    const allMatches: Match[] = [];
    const dayBoards = await Promise.all(
      block
        .slice(0, 5)
        .map(date => fetchESPN(date.toISOString().slice(0, 10).replace(/-/g, '')))
    );
    for (const day of dayBoards) {
      if (!day?.events) continue;
      for (const ev of day.events) {
        const state = ev.competitions[0]?.status.type.state;
        if (state !== 'pre' && state !== 'in') continue;
        const m = toMatch(ev, 1);
        if (m) allMatches.push(m);
      }
    }

    if (allMatches.length < 5) return null;

    // 5. Infer matchday number from season start
    const seasonStart = new Date(base.leagues[0]?.season?.startDate ?? base.leagues[0]?.calendar?.[0] ?? new Date());
    const weeks = Math.round((allMatches[0].scheduledAt.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const matchdayNum = Math.max(1, Math.min(38, weeks + 1));
    allMatches.forEach(m => (m.matchday = matchdayNum));

    const earliest = Math.min(...allMatches.map(m => m.scheduledAt.getTime()));
    return {
      number: matchdayNum,
      season: `${seasonStart.getUTCFullYear()}-${seasonStart.getUTCFullYear() + 1}`,
      matches: allMatches.slice(0, 10),
      deadline: new Date(earliest - 2 * 60 * 60 * 1000),
    };
  } catch (err) {
    console.warn('[ESPN] Unavailable, using mock data:', err);
    return null;
  }
}
