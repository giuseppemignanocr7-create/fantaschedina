// ============================================
// FANTASCHEDINA - REAL ODDS (odds-api.io)
// Fetch quote reali da bookmaker.
// Free tier: max 2 bookmaker, 5000 req/hour.
// Mercati coperti: ML (1X2), Totals (O/U), BTTS (GG/NG).
// Mercati non coperti → fallback al engine algoritmico.
// ============================================

import { generateMatchOdds, type MatchOdds } from './odds';

const API_BASE = 'https://api.odds-api.io/v3';
const LEAGUE_SLUG = 'italy-serie-a';
const BOOKMAKER = 'Goldbet IT';

// ---------- Tipi risposta API ----------

interface OddsApiEvent {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  date: string;
  status: string;
}

interface OddsApiMarketOdds {
  home?: string;
  draw?: string;
  away?: string;
  hdp?: number;
  over?: string;
  under?: string;
  yes?: string;
  no?: string;
}

interface OddsApiMarket {
  name: string;
  updatedAt: string;
  odds: OddsApiMarketOdds[];
}

interface OddsApiResponse {
  id: number;
  home: string;
  away: string;
  status: string;
  bookmakers: Record<string, OddsApiMarket[]>;
}

// ---------- Mapping nomi squadre ----------

const TEAM_CANONICAL: Record<string, string> = {
  'inter': 'inter', 'inter milan': 'inter', 'internazionale': 'inter', 'inter milano': 'inter', 'fc internazionale': 'inter',
  'milan': 'milan', 'ac milan': 'milan',
  'juventus': 'juventus', 'juve': 'juventus', 'juventus turin': 'juventus',
  'napoli': 'napoli', 'ssc napoli': 'napoli', 'naples': 'napoli',
  'atalanta': 'atalanta', 'atalanta bc': 'atalanta',
  'lazio': 'lazio', 'ss lazio': 'lazio',
  'roma': 'roma', 'as roma': 'roma', 'rome': 'roma',
  'fiorentina': 'fiorentina', 'acf fiorentina': 'fiorentina',
  'bologna': 'bologna', 'bologna fc': 'bologna',
  'torino': 'torino', 'toro': 'torino', 'torino fc': 'torino',
  'udinese': 'udinese', 'udinese calcio': 'udinese',
  'empoli': 'empoli', 'empoli fc': 'empoli',
  'genoa': 'genoa', 'genoa cfc': 'genoa', 'genoa cricket': 'genoa',
  'cagliari': 'cagliari', 'cagliari calcio': 'cagliari',
  'verona': 'verona', 'hellas verona': 'verona', 'hellas': 'verona',
  'parma': 'parma', 'parma calcio': 'parma',
  'como': 'como', 'como 1907': 'como', 'como calcio': 'como',
  'monza': 'monza', 'ac monza': 'monza',
  'venezia': 'venezia', 'venezia fc': 'venezia',
  'lecce': 'lecce', 'us lecce': 'lecce',
  'sassuolo': 'sassuolo', 'sas': 'sassuolo',
  'cremonese': 'cremonese', 'cre': 'cremonese',
  'salernitana': 'salernitana', 'sal': 'salernitana',
  'pisa': 'pisa', 'pis': 'pisa',
  'frosinone': 'frosinone', 'frosinone calcio': 'frosinone',
  'pescara': 'pescara',
  'brescia': 'brescia',
  'sampdoria': 'sampdoria', 'samp': 'sampdoria',
};

function canonicalName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (TEAM_CANONICAL[lower]) return TEAM_CANONICAL[lower];
  return lower
    .replace(/^(fc|ac|as|ssc|us|usv|hellas)\s+/g, '')
    .replace(/\s+(fc|cf|bc|cfc|calcio|1907|turin)\s*$/g, '')
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  return canonicalName(a) === canonicalName(b);
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---------- Fetch eventi Serie A ----------

async function fetchSerieAEvents(apiKey: string): Promise<OddsApiEvent[] | null> {
  try {
    const url = `${API_BASE}/events?sport=football&apiKey=${apiKey}&league=${LEAGUE_SLUG}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as OddsApiEvent[];
  } catch {
    return null;
  }
}

// ---------- Fetch quote per singolo evento ----------

async function fetchEventOdds(apiKey: string, eventId: number): Promise<OddsApiResponse | null> {
  try {
    const url = `${API_BASE}/odds?apiKey=${apiKey}&eventId=${eventId}&bookmakers=${encodeURIComponent(BOOKMAKER)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as OddsApiResponse;
  } catch {
    return null;
  }
}

// ---------- Estrazione quote ----------

function extractOddsFromResponse(
  response: OddsApiResponse
): Partial<MatchOdds> | null {
  const bookData = response.bookmakers?.[BOOKMAKER];
  if (!bookData || !Array.isArray(bookData)) return null;

  const result: Partial<MatchOdds> = {};

  for (const market of bookData) {
    if (market.name === 'ML' && market.odds.length > 0) {
      const o = market.odds[0];
      const h = num(o.home);
      const d = num(o.draw);
      const a = num(o.away);
      if (h != null && d != null && a != null) {
        result.esito = { '1': h, X: d, '2': a };
        result.doppia_chance = {
          '1X': Math.round((1 / (1 / h + 1 / d)) * 100) / 100,
          '12': Math.round((1 / (1 / h + 1 / a)) * 100) / 100,
          X2: Math.round((1 / (1 / d + 1 / a)) * 100) / 100,
        };
      }
    } else if (market.name === 'Totals') {
      // Find O/U 2.5
      const ou25 = market.odds.find(o => o.hdp === 2.5);
      if (ou25) {
        const ov = num(ou25.over);
        const un = num(ou25.under);
        if (ov != null && un != null) {
          result.over_under = { OVER: ov, UNDER: un };
        }
      }
    } else if (market.name === 'Both Teams To Score' && market.odds.length > 0) {
      const o = market.odds[0];
      const gg = num(o.yes);
      const ng = num(o.no);
      if (gg != null && ng != null) {
        result.goal_nogoal = { GG: gg, NG: ng };
      }
    }
  }

  return result;
}

// ---------- API pubblica ----------

export async function fetchRealMatchdayOdds(
  matches: {
    id: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
  }[],
  apiKey: string
): Promise<Record<string, MatchOdds> | null> {
  if (!apiKey) return null;

  const events = await fetchSerieAEvents(apiKey);
  if (!events || events.length === 0) return null;

  // Match each game to an API event, then fetch all odds in parallel
  const matchTasks = matches.map(async (match) => {
    const event = events.find(
      e => teamsMatch(e.home, match.homeTeam.name) && teamsMatch(e.away, match.awayTeam.name)
    );

    const algo = generateMatchOdds(match.homeTeam.id, match.awayTeam.id);

    if (event) {
      const oddsResponse = await fetchEventOdds(apiKey, event.id);
      if (oddsResponse) {
        const real = extractOddsFromResponse(oddsResponse);
        if (real && (real.esito || real.over_under || real.goal_nogoal)) {
          return {
            id: match.id,
            odds: {
              esito: real.esito ?? algo.esito,
              over_under: real.over_under ?? algo.over_under,
              goal_nogoal: real.goal_nogoal ?? algo.goal_nogoal,
              doppia_chance: real.doppia_chance ?? algo.doppia_chance,
              multigoal: algo.multigoal,
              esito_1t: algo.esito_1t,
              over_under_1t: algo.over_under_1t,
              goal_nogoal_1t: algo.goal_nogoal_1t,
            } as MatchOdds,
            isReal: true,
          };
        }
      }
    }

    return { id: match.id, odds: algo, isReal: false };
  });

  const results = await Promise.all(matchTasks);

  const result: Record<string, MatchOdds> = {};
  let hasAnyReal = false;

  for (const r of results) {
    result[r.id] = r.odds;
    if (r.isReal) hasAnyReal = true;
  }

  return hasAnyReal ? result : null;
}
