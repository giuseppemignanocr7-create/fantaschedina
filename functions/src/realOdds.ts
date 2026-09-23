// ============================================
// FANTASCHEDINA - REAL ODDS (odds-api.io)
// Fetch quote reali da bookmaker.
// Free tier: max 2 bookmaker, 5000 req/hour.
// Mercati coperti: ML (1X2), Totals (O/U), BTTS (GG/NG).
// Mercati non coperti → fallback al engine algoritmico.
// ============================================

import { generateMatchOdds, type MatchOdds } from './odds';
import { fetchJson } from './http';

const API_BASE = 'https://api.odds-api.io/v3';

/**
 * Agenzia usata dal circuito generale e da ogni lega che non ne ha chiesta
 * una propria. Le altre le sceglie l'amministratore fra quelle attive sul
 * piano (vedi bookmakerDisponibili).
 */
export const BOOKMAKER_PREDEFINITO = 'Goldbet IT';

/**
 * Codice campionato interno (COMPETITIONS in config.ts) → slug lega su
 * odds-api.io. uefa.champions/uefa.europa non hanno ancora uno slug stabile
 * fuori stagione (solo turni di qualificazione con nomi variabili): quando
 * riparte la fase a gironi va aggiunto qui.
 */
const ODDS_API_LEAGUE_SLUG: Record<string, string> = {
  'ita.1': 'italy-serie-a',
  'eng.1': 'england-premier-league',
  'esp.1': 'spain-laliga',
  'ger.1': 'germany-bundesliga',
  'fra.1': 'france-ligue-1',
  'ita.coppa_italia': 'italy-coppa-italia',
  'bra.1': 'brazil-brasileiro-serie-a',
  'usa.1': 'usa-mls',
};

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
  // 21/09/2026: il fornitore la chiama "Lazio Rome". Senza questa riga nessuna
  // partita della Lazio trovava il suo evento, e per cinque giornate di fila e'
  // finita sulle quote calcolate mentre tutte le altre avevano quelle reali.
  'lazio': 'lazio', 'ss lazio': 'lazio', 'lazio rome': 'lazio', 'lazio roma': 'lazio',
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

  // Brasileirão: nome ESPN + nome odds-api.io (accenti/sigle stato diversi)
  'athletico-pr': 'athletico-pr', 'ca paranaense pr': 'athletico-pr',
  'atlético-mg': 'atletico-mg', 'atletico mineiro mg': 'atletico-mg',
  'bahia': 'bahia', 'ec bahia ba': 'bahia',
  'botafogo': 'botafogo', 'botafogo fr rj': 'botafogo',
  'chapecoense': 'chapecoense', 'chapecoense sc': 'chapecoense',
  'corinthians': 'corinthians', 'sc corinthians sp': 'corinthians',
  'coritiba': 'coritiba', 'coritiba fc pr': 'coritiba',
  'cruzeiro': 'cruzeiro', 'cruzeiro ec mg': 'cruzeiro',
  'flamengo': 'flamengo', 'cr flamengo rj': 'flamengo',
  'fluminense': 'fluminense', 'fluminense fc rj': 'fluminense',
  'grêmio': 'gremio', 'gremio fb porto alegrense rs': 'gremio',
  'internacional': 'internacional-bra', 'sc internacional rs': 'internacional-bra',
  'mirassol': 'mirassol', 'mirassol fc sp': 'mirassol',
  'palmeiras': 'palmeiras', 'se palmeiras sp': 'palmeiras',
  'red bull bragantino': 'red-bull-bragantino', 'red bull bragantino sp': 'red-bull-bragantino',
  'remo': 'remo', 'clube do remo pa': 'remo',
  'santos': 'santos', 'santos fc sp': 'santos',
  'são paulo': 'sao-paulo', 'sao paulo fc sp': 'sao-paulo',
  'vasco da gama': 'vasco-da-gama', 'cr vasco da gama rj': 'vasco-da-gama',
  'vitória': 'vitoria', 'ec vitoria ba': 'vitoria',

  // MLS: nome ESPN + nome odds-api.io (sigle/ordine parole/punteggiatura diversi)
  'atlanta united fc': 'atlanta-utd',
  'austin fc': 'austin',
  'cf montréal': 'cf-montreal', 'cf montreal': 'cf-montreal',
  'charlotte fc': 'charlotte',
  'chicago fire fc': 'chicago-fire', 'chicago fire': 'chicago-fire',
  'colorado rapids': 'colorado-rapids',
  'columbus crew': 'columbus-crew',
  'd.c. united': 'dc-united', 'dc united': 'dc-united',
  'fc cincinnati': 'fc-cincinnati',
  'fc dallas': 'fc-dallas',
  'houston dynamo fc': 'houston-dynamo', 'houston dynamo': 'houston-dynamo',
  'inter miami cf': 'inter-miami',
  'la galaxy': 'la-galaxy', 'los angeles galaxy': 'la-galaxy',
  'lafc': 'lafc', 'los angeles fc': 'lafc',
  'minnesota united fc': 'minnesota-utd',
  'nashville sc': 'nashville',
  'new england revolution': 'new-england-revolution',
  'new york city fc': 'nycfc',
  'red bull new york': 'ny-red-bulls', 'new york red bulls': 'ny-red-bulls',
  'orlando city sc': 'orlando-city',
  'philadelphia union': 'philadelphia-union',
  'portland timbers': 'portland-timbers',
  'real salt lake': 'real-salt-lake',
  'san diego fc': 'san-diego',
  'san jose earthquakes': 'san-jose',
  'seattle sounders fc': 'seattle-sounders', 'seattle sounders': 'seattle-sounders',
  'sporting kansas city': 'sporting-kc',
  'st. louis city sc': 'st-louis-city', 'saint louis city sc': 'st-louis-city',
  'toronto fc': 'toronto',
  'vancouver whitecaps': 'vancouver-whitecaps', 'vancouver whitecaps fc': 'vancouver-whitecaps',
};

/**
 * Nomi esatti usati dal fornitore per la Serie A (verificati il 21/09/2026
 * interrogando /events). Tenerli scritti evita di dipendere dalle regole
 * generiche qui sotto per squadre che sappiamo come vengono chiamate.
 */
const FORNITORE_SERIE_A: Record<string, string> = {
  'ac milan': 'milan',
  'ac monza': 'monza',
  'acf fiorentina': 'fiorentina',
  'as roma': 'roma',
  'atalanta bc': 'atalanta',
  'bologna fc': 'bologna',
  'cagliari calcio': 'cagliari',
  'como 1907': 'como',
  'frosinone calcio': 'frosinone',
  'genoa cfc': 'genoa',
  'inter milano': 'inter',
  'juventus turin': 'juventus',
  'lazio rome': 'lazio',
  'parma calcio': 'parma',
  'ssc napoli': 'napoli',
  'sassuolo calcio': 'sassuolo',
  'torino fc': 'torino',
  'us lecce': 'lecce',
  'udinese calcio': 'udinese',
  'venezia fc': 'venezia',
};

export function canonicalName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (FORNITORE_SERIE_A[lower]) return FORNITORE_SERIE_A[lower];
  if (TEAM_CANONICAL[lower]) return TEAM_CANONICAL[lower];
  return lower
    .replace(/^(fc|ac|as|ssc|us|usv|hellas)\s+/g, '')
    // Citta' appiccicata al nome dal fornitore ("Lazio Rome", "Inter Milano").
    .replace(/\s+(fc|cf|bc|cfc|calcio|1907|turin|rome|roma|milano|milan)\s*$/g, '')
    .trim();
}

export function teamsMatch(a: string, b: string): boolean {
  return canonicalName(a) === canonicalName(b);
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---------- Fetch eventi per campionato ----------

async function fetchLeagueEvents(apiKey: string, leagueSlug: string): Promise<OddsApiEvent[] | null> {
  const url = `${API_BASE}/events?sport=football&apiKey=${apiKey}&league=${leagueSlug}&limit=100`;
  return fetchJson<OddsApiEvent[]>(url, { label: `odds-api:events:${leagueSlug}` });
}

// ---------- Fetch quote per singolo evento ----------

async function fetchEventOdds(
  apiKey: string,
  eventId: number,
  bookmakers: string[]
): Promise<OddsApiResponse | null> {
  // Le agenzie si chiedono tutte insieme: il fornitore le restituisce in un
  // unico oggetto, quindi due leghe su due agenzie diverse non costano due
  // chiamate. Oltre il numero consentito dal piano risponde 403, ed e' il
  // motivo per cui la lista la decide bookmakerDisponibili.
  const url = `${API_BASE}/odds?apiKey=${apiKey}&eventId=${eventId}&bookmakers=${encodeURIComponent(bookmakers.join(','))}`;
  return fetchJson<OddsApiResponse>(url, { label: 'odds-api:odds' });
}

interface BookmakerSelezionati {
  bookmakers?: string[];
  count?: number;
}

/**
 * Agenzie attive sul piano sottoscritto. Sul piano in uso sono due: sceglierne
 * altre richiede un piano superiore, quindi l'amministratore deve vedere
 * quali sono davvero disponibili invece di indovinare.
 */
export async function bookmakerDisponibili(apiKey: string): Promise<string[]> {
  if (!apiKey) return [BOOKMAKER_PREDEFINITO];
  const res = await fetchJson<BookmakerSelezionati>(
    `${API_BASE}/bookmakers/selected?apiKey=${apiKey}`,
    { label: 'odds-api:bookmakers' }
  );
  const lista = res?.bookmakers ?? [];
  return lista.length > 0 ? lista : [BOOKMAKER_PREDEFINITO];
}

// ---------- Estrazione quote ----------

function extractOddsFromResponse(
  response: OddsApiResponse,
  bookmaker: string
): Partial<MatchOdds> | null {
  const bookData = response.bookmakers?.[bookmaker];
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

/**
 * Quote di una giornata per ognuna delle agenzie richieste.
 *
 * Il risultato e' indicizzato per agenzia: `quote['Goldbet IT'][matchId]`.
 * Ogni agenzia ha una mappa completa — dove mancano le quote reali (partita
 * non trovata, mercato assente) resta il motore di calcolo, cosi' nessuna
 * lega si ritrova con una partita senza quote.
 *
 * Restituisce null solo se nessuna agenzia ha prodotto nemmeno una quota
 * reale: in quel caso chi chiama usa il motore di calcolo per tutti.
 */
export async function fetchRealMatchdayOdds(
  matches: {
    id: string;
    competition: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
  }[],
  apiKey: string,
  bookmakers: string[] = [BOOKMAKER_PREDEFINITO]
): Promise<Record<string, Record<string, MatchOdds>> | null> {
  if (!apiKey || bookmakers.length === 0) return null;

  const slugsNeeded = [...new Set(
    matches.map(m => ODDS_API_LEAGUE_SLUG[m.competition]).filter((s): s is string => !!s)
  )];
  if (slugsNeeded.length === 0) return null;

  const eventsBySlug = new Map<string, OddsApiEvent[]>();
  await Promise.all(slugsNeeded.map(async slug => {
    const events = await fetchLeagueEvents(apiKey, slug);
    if (events && events.length > 0) eventsBySlug.set(slug, events);
  }));
  if (eventsBySlug.size === 0) return null;

  const risultato: Record<string, Record<string, MatchOdds>> = {};
  for (const b of bookmakers) risultato[b] = {};
  let qualcunaReale = false;

  const compiti = matches.map(async match => {
    const slug = ODDS_API_LEAGUE_SLUG[match.competition];
    const events = slug ? eventsBySlug.get(slug) : undefined;
    const event = events?.find(
      e => teamsMatch(e.home, match.homeTeam.name) && teamsMatch(e.away, match.awayTeam.name)
    );
    const algo = generateMatchOdds(match.homeTeam.id, match.awayTeam.id);
    const risposta = event ? await fetchEventOdds(apiKey, event.id, bookmakers) : null;

    return bookmakers.map(bookmaker => {
      const real = risposta ? extractOddsFromResponse(risposta, bookmaker) : null;
      if (real && (real.esito || real.over_under || real.goal_nogoal)) {
        return {
          bookmaker,
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
      return { bookmaker, id: match.id, odds: algo, isReal: false };
    });
  });

  for (const perPartita of await Promise.all(compiti)) {
    for (const r of perPartita) {
      risultato[r.bookmaker][r.id] = r.odds;
      if (r.isReal) qualcunaReale = true;
    }
  }

  return qualcunaReale ? risultato : null;
}
