// ============================================
// FANTASCHEDINA FUNCTIONS - ESPN CLIENT (server-side)
// Fetch pool multi-campionato + risultati (incl. parziale 1° tempo dai linescores).
// ============================================

import { fetchJson } from './http';

const ESPN_BASE = (slug: string) => `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}`;

const ESPN_TO_ID: Record<string, string> = {
  INT: 'int', MIL: 'mil', JUV: 'juv', NAP: 'nap', ATA: 'ata',
  LAZ: 'laz', ROMA: 'rom', ROM: 'rom', FIO: 'fio', BOL: 'bol',
  TOR: 'tor', UDI: 'udi', EMP: 'emp', GEN: 'gen', CAG: 'cag',
  VER: 'ver', HEL: 'ver', PAR: 'par', COMO: 'com', COM: 'com',
  MON: 'mon', VEN: 'ven', LEC: 'lec', SAS: 'sas', CRE: 'cre',
  SAL: 'sal', PIS: 'pis',
};

interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  linescores?: { value: number }[];
  team: { abbreviation: string; displayName: string; logo?: string };
}

interface ESPNEvent {
  id: string;
  date: string;
  competitions: Array<{
    status: { type: { state: 'pre' | 'in' | 'post'; completed: boolean } };
    competitors: ESPNCompetitor[];
  }>;
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
  status: 'scheduled' | 'live' | 'finished';
}

export interface EspnResult {
  homeGoals: number;
  awayGoals: number;
  htHomeGoals?: number;
  htAwayGoals?: number;
  status: 'scheduled' | 'live' | 'finished';
}

async function fetchScoreboard(slug: string, dateStr?: string): Promise<ESPNScoreboard | null> {
  const url = dateStr
    ? `${ESPN_BASE(slug)}/scoreboard?dates=${dateStr}&limit=50`
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

  const days = block
    .slice(0, 5)
    .map(d => d.toISOString().slice(0, 10).replace(/-/g, ''));
  const boards = await Promise.all(days.map(d => fetchScoreboard(slug, d)));

  const matches: EspnMatch[] = [];
  for (const day of boards) {
    for (const ev of day?.events ?? []) {
      const comp = ev.competitions[0];
      if (!comp) continue;
      const state = comp.status.type.state;
      if (state !== 'pre' && state !== 'in') continue;
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      matches.push({
        id: `espn-${ev.id}`,
        competition: code,
        homeTeam: teamOf(home),
        awayTeam: teamOf(away),
        scheduledAt: new Date(ev.date),
        status: state === 'in' ? 'live' : 'scheduled',
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

  if (matches.length < 5) return null;

  matches.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const earliest = matches[0].scheduledAt.getTime();

  return {
    matches: matches.slice(0, 80),
    deadline: new Date(earliest - 2 * 60 * 60 * 1000),
    seasonStart: seasonStart ?? new Date(),
    season,
  };
}

/** Risultati per un set di partite multi-campionato (id interno = `espn-${eventId}`). */
export async function fetchResults(
  matches: { id: string; scheduledAt: Date; competition: string }[]
): Promise<Map<string, EspnResult>> {
  const out = new Map<string, EspnResult>();
  if (matches.length === 0) return out;

  // Raggruppa per campionato + giorno, per interrogare l'endpoint ESPN corretto
  // (competition == slug ESPN, vedi COMPETITIONS in config.ts).
  const groups = new Map<string, { slug: string; day: string }>();
  for (const m of matches) {
    const day = m.scheduledAt.toISOString().slice(0, 10).replace(/-/g, '');
    groups.set(`${m.competition}_${day}`, { slug: m.competition, day });
  }

  const wanted = new Set(matches.map(m => m.id));
  const boards = await Promise.all(
    [...groups.values()].map(({ slug, day }) => fetchScoreboard(slug, day))
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
      const state = comp.status.type.state;
      const htHome = home.linescores?.[0]?.value;
      const htAway = away.linescores?.[0]?.value;
      out.set(internalId, {
        homeGoals: parseInt(home.score ?? '0', 10),
        awayGoals: parseInt(away.score ?? '0', 10),
        ...(htHome != null && htAway != null
          ? { htHomeGoals: htHome, htAwayGoals: htAway }
          : {}),
        status:
          state === 'post' && comp.status.type.completed
            ? 'finished'
            : state === 'in'
            ? 'live'
            : 'scheduled',
      });
    }
  }
  return out;
}
