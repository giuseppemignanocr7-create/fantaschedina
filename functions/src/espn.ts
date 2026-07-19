// ============================================
// FANTASCHEDINA FUNCTIONS - ESPN CLIENT (server-side)
// Fetch giornata + risultati (incl. parziale 1° tempo dai linescores).
// ============================================

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

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

async function fetchScoreboard(dateStr?: string): Promise<ESPNScoreboard | null> {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=20`
      : `${ESPN_BASE}/scoreboard?limit=20`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as ESPNScoreboard;
  } catch {
    return null;
  }
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

/** Prossima giornata: blocco di date entro 5 giorni dalla prima futura. */
export async function fetchNextMatchday(): Promise<{
  matches: EspnMatch[];
  deadline: Date;
  seasonStart: Date;
  season: string;
} | null> {
  const base = await fetchScoreboard();
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
  const boards = await Promise.all(days.map(d => fetchScoreboard(d)));

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
        homeTeam: teamOf(home),
        awayTeam: teamOf(away),
        scheduledAt: new Date(ev.date),
        status: state === 'in' ? 'live' : 'scheduled',
      });
    }
  }

  if (matches.length < 5) return null;

  const earliest = Math.min(...matches.map(m => m.scheduledAt.getTime()));
  const seasonStart = new Date(
    base.leagues[0]?.season?.startDate ?? base.leagues[0]?.calendar?.[0] ?? Date.now()
  );
  return {
    matches: matches.slice(0, 10),
    deadline: new Date(earliest - 60 * 60 * 1000),
    seasonStart,
    season: `${seasonStart.getUTCFullYear()}-${seasonStart.getUTCFullYear() + 1}`,
  };
}

/** Risultati per un set di partite (id interno = `espn-${eventId}`). */
export async function fetchResults(
  matches: { id: string; scheduledAt: Date }[]
): Promise<Map<string, EspnResult>> {
  const out = new Map<string, EspnResult>();
  if (matches.length === 0) return out;

  const days = new Set<string>();
  for (const m of matches) {
    days.add(m.scheduledAt.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const boards = await Promise.all([...days].map(d => fetchScoreboard(d)));
  const wanted = new Set(matches.map(m => m.id));

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
