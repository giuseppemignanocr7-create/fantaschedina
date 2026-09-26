// ============================================
// FANTA SCHEDINA - FOOTBALL DATA SERVICE
// ESPN public API — nessuna chiave richiesta
// https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1
// ============================================

import type { Match, MatchOutcome } from '@/types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

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
  events: ESPNEvent[];
}

async function fetchESPN(dateStr: string): Promise<ESPNScoreboard | null> {
  try {
    const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=20`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<ESPNScoreboard>;
  } catch {
    return null;
  }
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

