// ============================================
// FANTASCHEDINA - REAL ODDS (odds-api.io)
// Fetch quote reali da bookmaker.
// Free tier: max 2 bookmaker, 5000 req/hour.
// Mercati coperti: ML (1X2), Totals (O/U), BTTS (GG/NG).
// Mercati non coperti → non si giocano (nessuna quota calcolata).
// ============================================

import type { MatchOdds } from './odds';
import { fetchJson } from './http';
import { ODDS_API_LEAGUE_SLUG } from './palinsesto';

const API_BASE = 'https://api.odds-api.io/v3';

/**
 * Agenzia usata dal circuito generale e da ogni lega che non ne ha chiesta
 * una propria. Le altre le sceglie l'amministratore fra quelle attive sul
 * piano (vedi bookmakerDisponibili).
 */
export const BOOKMAKER_PREDEFINITO = 'Goldbet IT';

// Codice campionato → slug del fornitore: vedi ODDS_API_LEAGUE_SLUG in
// palinsesto.ts (serve anche all'attivazione dei campionati).

// ---------- Tipi risposta API ----------

export interface OddsApiEvent {
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
  'hellas verona fc': 'verona', 'verona fc': 'verona',
  'parma': 'parma', 'parma calcio': 'parma',
  'como': 'como', 'como 1907': 'como', 'como calcio': 'como',
  'monza': 'monza', 'ac monza': 'monza',
  'venezia': 'venezia', 'venezia fc': 'venezia',
  'lecce': 'lecce', 'us lecce': 'lecce',
  'sassuolo': 'sassuolo', 'sas': 'sassuolo',
  'cremonese': 'cremonese', 'cre': 'cremonese', 'us cremonese': 'cremonese',
  'salernitana': 'salernitana', 'sal': 'salernitana',
  'pisa': 'pisa', 'pis': 'pisa', 'ac pisa': 'pisa', 'ac pisa 1909': 'pisa',
  'pisa sc': 'pisa', 'sc pisa': 'pisa', 'pisa sporting club': 'pisa',
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
  // Neopromosse 2025/26: i nomi del fornitore non erano in elenco e le loro
  // partite restavano senza evento abbinato. Si coprono le forme con e senza
  // sigla societaria, cosi' un cambio di dicitura non le fa sparire.
  'ac pisa 1909': 'pisa',
  'pisa sc': 'pisa',
  'us cremonese': 'cremonese',
  'hellas verona': 'verona',
  'hellas verona fc': 'verona',
};

export function canonicalName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (FORNITORE_SERIE_A[lower]) return FORNITORE_SERIE_A[lower];
  if (TEAM_CANONICAL[lower]) return TEAM_CANONICAL[lower];
  return lower
    .replace(/^(fc|ac|as|ssc|us|usv|hellas)\s+/g, '')
    // Citta' appiccicata al nome dal fornitore ("Lazio Rome", "Inter Milano").
    .replace(/\s+(fc|cf|bc|cfc|calcio|1907|1909|turin|rome|roma|milano|milan)\s*$/g, '')
    .trim();
}

export function teamsMatch(a: string, b: string): boolean {
  return canonicalName(a) === canonicalName(b);
}

/**
 * Scarto massimo fra l'orario ESPN e quello del fornitore perche' siano la
 * stessa partita. Con i soli nomi, un evento di un'altra giornata (andata e
 * ritorno, recupero, coppa) si abbinava lo stesso e la partita prendeva le
 * quote di un'altra gara.
 */
export const SCARTO_MASSIMO_MS = 36 * 60 * 60 * 1000;

/**
 * Evento del fornitore che corrisponde alla partita: stesse squadre, orario
 * entro ±36 ore e ancora da giocare (`pending`). Un evento gia' iniziato,
 * rinviato o cancellato non si usa: le sue quote non sono piu' quelle di
 * una partita da giocare.
 */
export function trovaEvento(
  events: OddsApiEvent[],
  match: { homeTeam: { name: string }; awayTeam: { name: string }; scheduledAt: Date }
): OddsApiEvent | undefined {
  const kickoff = match.scheduledAt.getTime();
  return events.find(e => {
    if (e.status !== 'pending') return false;
    if (!teamsMatch(e.home, match.homeTeam.name) || !teamsMatch(e.away, match.awayTeam.name)) {
      return false;
    }
    const data = Date.parse(e.date);
    return Number.isFinite(data) && Math.abs(data - kickoff) <= SCARTO_MASSIMO_MS;
  });
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

/** Linea over/under da usare per il mercato Multigoal dell'app. */
const LINEE_MULTIGOAL = [0.5, 1.5, 2.5, 3.5] as const;

/**
 * Traduce la risposta del fornitore nei mercati dell'app, prendendo solo
 * quello che il bookmaker pubblica davvero.
 *
 * Nessun mercato viene inventato: quello che il fornitore non ha resta
 * assente, e l'app non lo mette in schedina. Fino al 23/09/2026 i mercati
 * mancanti venivano riempiti da un motore di calcolo, e il risultato erano
 * quote che nessun bookmaker avrebbe mai esposto.
 *
 * Corrispondenze verificate il 23/09/2026 su Serie A:
 *   ML → esito · Double Chance → doppia_chance · Totals → over_under (2.5)
 *   e multigoal (0.5/1.5/2.5/3.5) · Both Teams To Score → goal_nogoal
 *   ML HT → esito_1t · Totals HT (1.5) → over_under_1t
 * Il GG/NG di primo tempo non lo pubblica nessuna delle agenzie: non esiste
 * piu' come mercato giocabile.
 */
export function extractOddsFromResponse(
  response: OddsApiResponse,
  bookmaker: string
): Partial<MatchOdds> | null {
  const bookData = response.bookmakers?.[bookmaker];
  if (!bookData || !Array.isArray(bookData)) return null;

  const result: Partial<MatchOdds> = {};

  for (const market of bookData) {
    switch (market.name) {
      case 'ML': {
        const o = market.odds[0];
        const h = num(o?.home);
        const d = num(o?.draw);
        const a = num(o?.away);
        if (h != null && d != null && a != null) result.esito = { '1': h, X: d, '2': a };
        break;
      }
      case 'Double Chance': {
        const o = market.odds[0] as (OddsApiMarketOdds & Record<string, string>) | undefined;
        const unoX = num(o?.['1X']);
        const unoDue = num(o?.['12']);
        const xDue = num(o?.['X2']);
        if (unoX != null && unoDue != null && xDue != null) {
          result.doppia_chance = { '1X': unoX, '12': unoDue, X2: xDue };
        }
        break;
      }
      case 'Totals': {
        const linea = (v: number) => market.odds.find(o => o.hdp === v);
        const due5 = linea(2.5);
        const ov25 = num(due5?.over);
        const un25 = num(due5?.under);
        if (ov25 != null && un25 != null) result.over_under = { OVER: ov25, UNDER: un25 };

        const multigoal: Record<string, number> = {};
        for (const l of LINEE_MULTIGOAL) {
          const riga = linea(l);
          const ov = num(riga?.over);
          const un = num(riga?.under);
          if (ov != null) multigoal[`O${l}`] = ov;
          if (un != null) multigoal[`U${l}`] = un;
        }
        // Solo se il bookmaker copre tutte le linee: una tabella a buchi in
        // schedina confonde piu' di quanto aggiunga.
        if (Object.keys(multigoal).length === LINEE_MULTIGOAL.length * 2) {
          result.multigoal = multigoal;
        }
        break;
      }
      case 'Both Teams To Score': {
        const o = market.odds[0];
        const gg = num(o?.yes);
        const ng = num(o?.no);
        if (gg != null && ng != null) result.goal_nogoal = { GG: gg, NG: ng };
        break;
      }
      case 'ML HT': {
        const o = market.odds[0];
        const h = num(o?.home);
        const d = num(o?.draw);
        const a = num(o?.away);
        if (h != null && d != null && a != null) result.esito_1t = { '1': h, X: d, '2': a };
        break;
      }
      case 'Totals HT': {
        const uno5 = market.odds.find(o => o.hdp === 1.5);
        const ov = num(uno5?.over);
        const un = num(uno5?.under);
        if (ov != null && un != null) result.over_under_1t = { OVER: ov, UNDER: un };
        break;
      }
      default:
        break;
    }
  }

  return result;
}

// ---------- API pubblica ----------

/** Una partita ha quote giocabili solo se ha almeno l'1X2. */
export function haQuoteGiocabili(odds: Partial<MatchOdds> | undefined): boolean {
  return !!odds?.esito;
}

export interface QuoteScaricate {
  /** Quote per agenzia: `quote['Goldbet IT'][matchId]`. */
  quote: Record<string, Record<string, MatchOdds>>;
  /**
   * Partite per cui il fornitore ha risposto davvero: per queste, se una
   * agenzia non ha quote, vuol dire che non le pubblica (o le ha ritirate).
   * Le altre (errore di rete, campionato non caricato) restano in sospeso.
   */
  verificate: string[];
}

/**
 * Quote di una giornata per ognuna delle agenzie richieste, prese solo dal
 * fornitore.
 *
 * Una partita compare solo se quell'agenzia ne pubblica almeno l'1X2, e di
 * ogni partita compaiono solo i mercati davvero quotati. Chi chiama decide
 * cosa fare con le partite mancanti: qui non si inventa nulla. Restituisce
 * null solo se il fornitore non ha risposto per nessun campionato.
 */
export async function fetchRealMatchdayOdds(
  matches: {
    id: string;
    competition: string;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    scheduledAt: Date;
  }[],
  apiKey: string,
  bookmakers: string[] = [BOOKMAKER_PREDEFINITO]
): Promise<QuoteScaricate | null> {
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
  const verificate: string[] = [];

  const compiti = matches.map(async match => {
    const slug = ODDS_API_LEAGUE_SLUG[match.competition];
    const events = slug ? eventsBySlug.get(slug) : undefined;
    // Campionato non caricato: non si sa nulla, non si conclude nulla.
    if (!events) return [];
    const event = trovaEvento(events, match);
    if (!event) {
      // Palinsesto letto e partita assente (o non piu' da giocare): per il
      // fornitore oggi non e' quotata.
      verificate.push(match.id);
      return [];
    }
    const risposta = await fetchEventOdds(apiKey, event.id, bookmakers);
    if (!risposta) return [];
    verificate.push(match.id);

    return bookmakers
      .map(bookmaker => ({
        bookmaker,
        id: match.id,
        odds: extractOddsFromResponse(risposta, bookmaker) ?? {},
      }))
      .filter(r => haQuoteGiocabili(r.odds));
  });

  for (const perPartita of await Promise.all(compiti)) {
    for (const r of perPartita) {
      risultato[r.bookmaker][r.id] = r.odds as MatchOdds;
    }
  }

  return { quote: risultato, verificate };
}
