// ============================================
// FANTA SCHEDINA - DATI DI ESEMPIO
// ============================================

import type { Match, Participant, RankingEntry, Team } from '@/types';

// Calcola date dinamiche per il prossimo weekend
function nextWeekendBase(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 6=sab
  const daysToSat = ((6 - day) + 7) % 7 || 7;
  const sat = new Date(d);
  sat.setDate(d.getDate() + daysToSat);
  sat.setHours(0, 0, 0, 0);
  return sat;
}

const BASE = nextWeekendBase();

function md(dayOffset: number, hour: number, min = 0): Date {
  const d = new Date(BASE);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d;
}

export function getNextMatchdayDeadline(): Date {
  const d = new Date(BASE);
  d.setHours(d.getHours() - 1);
  return d;
}

// Squadre Serie A
export const SERIE_A_TEAMS: Team[] = [
  { id: 'nap', name: 'Napoli', shortName: 'NAP' },
  { id: 'int', name: 'Inter', shortName: 'INT' },
  { id: 'juv', name: 'Juventus', shortName: 'JUV' },
  { id: 'mil', name: 'Milan', shortName: 'MIL' },
  { id: 'ata', name: 'Atalanta', shortName: 'ATA' },
  { id: 'laz', name: 'Lazio', shortName: 'LAZ' },
  { id: 'rom', name: 'Roma', shortName: 'ROM' },
  { id: 'fio', name: 'Fiorentina', shortName: 'FIO' },
  { id: 'bol', name: 'Bologna', shortName: 'BOL' },
  { id: 'tor', name: 'Torino', shortName: 'TOR' },
  { id: 'udi', name: 'Udinese', shortName: 'UDI' },
  { id: 'emp', name: 'Empoli', shortName: 'EMP' },
  { id: 'gen', name: 'Genoa', shortName: 'GEN' },
  { id: 'cag', name: 'Cagliari', shortName: 'CAG' },
  { id: 'ver', name: 'Verona', shortName: 'VER' },
  { id: 'lec', name: 'Lecce', shortName: 'LEC' },
  { id: 'par', name: 'Parma', shortName: 'PAR' },
  { id: 'com', name: 'Como', shortName: 'COM' },
  { id: 'mon', name: 'Monza', shortName: 'MON' },
  { id: 'ven', name: 'Venezia', shortName: 'VEN' },
];

const getTeam = (id: string): Team => SERIE_A_TEAMS.find(t => t.id === id)!;

// Partite Giornata 38 – 10 partite, date dinamiche (prossimo weekend)
export const MOCK_MATCHES: Match[] = [
  { id: 'm1',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('nap'), awayTeam: getTeam('juv'), scheduledAt: md(0, 15,  0), status: 'scheduled' },
  { id: 'm2',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('int'), awayTeam: getTeam('mil'), scheduledAt: md(0, 18,  0), status: 'scheduled' },
  { id: 'm3',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('ata'), awayTeam: getTeam('laz'), scheduledAt: md(0, 20, 45), status: 'scheduled' },
  { id: 'm4',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('rom'), awayTeam: getTeam('fio'), scheduledAt: md(1, 12, 30), status: 'scheduled' },
  { id: 'm5',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('bol'), awayTeam: getTeam('tor'), scheduledAt: md(1, 15,  0), status: 'scheduled' },
  { id: 'm6',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('udi'), awayTeam: getTeam('emp'), scheduledAt: md(1, 15,  0), status: 'scheduled' },
  { id: 'm7',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('gen'), awayTeam: getTeam('cag'), scheduledAt: md(1, 15,  0), status: 'scheduled' },
  { id: 'm8',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('ver'), awayTeam: getTeam('lec'), scheduledAt: md(1, 18,  0), status: 'scheduled' },
  { id: 'm9',  matchday: 38, competition: 'ita.1', homeTeam: getTeam('par'), awayTeam: getTeam('com'), scheduledAt: md(1, 18,  0), status: 'scheduled' },
  { id: 'm10', matchday: 38, competition: 'ita.1', homeTeam: getTeam('mon'), awayTeam: getTeam('ven'), scheduledAt: md(1, 20, 45), status: 'scheduled' },
];

// 55 Partecipanti con dati fissi e realistici
export const MOCK_PARTICIPANTS: Participant[] = [
  { id: 'p1',  username: 'MarioRossi',       email: 'mario.rossi@example.com',       createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 684.5,  weeklyPoints: 48.2,  rank: 1,  paidWeeks: 37 },
  { id: 'p2',  username: 'LucaBianchi',       email: 'luca.bianchi@example.com',       createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 652.0,  weeklyPoints: 51.5,  rank: 2,  paidWeeks: 37 },
  { id: 'p3',  username: 'GiuseppeVerdi',     email: 'giuseppe.verdi@example.com',     createdAt: '2025-08-20T00:00:00.000Z', isActive: true,  totalPoints: 628.8,  weeklyPoints: 39.5,  rank: 3,  paidWeeks: 37 },
  { id: 'p4',  username: 'AntonioNeri',       email: 'antonio.neri@example.com',       createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 593.2,  weeklyPoints: 42.1,  rank: 4,  paidWeeks: 37 },
  { id: 'p5',  username: 'FrancescoGialli',   email: 'francesco.gialli@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 571.5,  weeklyPoints: 36.8,  rank: 5,  paidWeeks: 37 },
  { id: 'p6',  username: 'AlessandroBlu',     email: 'alessandro.blu@example.com',     createdAt: '2025-08-22T00:00:00.000Z', isActive: true,  totalPoints: 549.0,  weeklyPoints: 45.5,  rank: 6,  paidWeeks: 36 },
  { id: 'p7',  username: 'MarcoViola',        email: 'marco.viola@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 527.8,  weeklyPoints: 31.2,  rank: 7,  paidWeeks: 37 },
  { id: 'p8',  username: 'DavideArancio',     email: 'davide.arancio@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 514.5,  weeklyPoints: 28.8,  rank: 8,  paidWeeks: 37 },
  { id: 'p9',  username: 'AndreaEsposito',    email: 'andrea.esposito@example.com',    createdAt: '2025-08-18T00:00:00.000Z', isActive: true,  totalPoints: 499.2,  weeklyPoints: 37.5,  rank: 9,  paidWeeks: 37 },
  { id: 'p10', username: 'SimoneRusso',       email: 'simone.russo@example.com',       createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 483.5,  weeklyPoints: 40.2,  rank: 10, paidWeeks: 37 },
  { id: 'p11', username: 'MatteoFerrari',     email: 'matteo.ferrari@example.com',     createdAt: '2025-08-25T00:00:00.000Z', isActive: true,  totalPoints: 468.8,  weeklyPoints: 34.5,  rank: 11, paidWeeks: 36 },
  { id: 'p12', username: 'LorenzoRomano',     email: 'lorenzo.romano@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 452.2,  weeklyPoints: 29.5,  rank: 12, paidWeeks: 37 },
  { id: 'p13', username: 'GabrieleColomb',    email: 'gabriele.colombo@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 439.5,  weeklyPoints: 38.8,  rank: 13, paidWeeks: 37 },
  { id: 'p14', username: 'RiccardoRicci',     email: 'riccardo.ricci@example.com',     createdAt: '2025-09-01T00:00:00.000Z', isActive: true,  totalPoints: 426.8,  weeklyPoints: 41.5,  rank: 14, paidWeeks: 35 },
  { id: 'p15', username: 'FedericoMarino',    email: 'federico.marino@example.com',    createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 413.2,  weeklyPoints: 27.2,  rank: 15, paidWeeks: 37 },
  { id: 'p16', username: 'StefanoGreco',      email: 'stefano.greco@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 401.5,  weeklyPoints: 35.5,  rank: 16, paidWeeks: 37 },
  { id: 'p17', username: 'NicolaBruno',       email: 'nicola.bruno@example.com',       createdAt: '2025-08-28T00:00:00.000Z', isActive: true,  totalPoints: 388.8,  weeklyPoints: 32.2,  rank: 17, paidWeeks: 36 },
  { id: 'p18', username: 'FabioGallo',        email: 'fabio.gallo@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 376.2,  weeklyPoints: 28.5,  rank: 18, paidWeeks: 37 },
  { id: 'p19', username: 'DanieleConti',      email: 'daniele.conti@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 364.5,  weeklyPoints: 43.2,  rank: 19, paidWeeks: 37 },
  { id: 'p20', username: 'CristianDeLuca',    email: 'cristian.deluca@example.com',    createdAt: '2025-09-05T00:00:00.000Z', isActive: true,  totalPoints: 351.8,  weeklyPoints: 36.8,  rank: 20, paidWeeks: 34 },
  { id: 'p21', username: 'EmanueleMancini',   email: 'emanuele.mancini@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 340.2,  weeklyPoints: 25.5,  rank: 21, paidWeeks: 37 },
  { id: 'p22', username: 'PaoloCosta',        email: 'paolo.costa@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 328.5,  weeklyPoints: 39.2,  rank: 22, paidWeeks: 37 },
  { id: 'p23', username: 'GiovanniGiordano',  email: 'giovanni.giordano@example.com',  createdAt: '2025-08-20T00:00:00.000Z', isActive: true,  totalPoints: 316.8,  weeklyPoints: 27.8,  rank: 23, paidWeeks: 37 },
  { id: 'p24', username: 'VincenzoRizzo',     email: 'vincenzo.rizzo@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 305.2,  weeklyPoints: 34.5,  rank: 24, paidWeeks: 37 },
  { id: 'p25', username: 'SalvatoreLombardi', email: 'salvatore.lombardi@example.com', createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 293.5,  weeklyPoints: 40.8,  rank: 25, paidWeeks: 37 },
  { id: 'p26', username: 'RobertoMoretti',    email: 'roberto.moretti@example.com',    createdAt: '2025-09-10T00:00:00.000Z', isActive: true,  totalPoints: 281.8,  weeklyPoints: 26.2,  rank: 26, paidWeeks: 33 },
  { id: 'p27', username: 'MicheleBarbieri',   email: 'michele.barbieri@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 270.2,  weeklyPoints: 31.5,  rank: 27, paidWeeks: 37 },
  { id: 'p28', username: 'TommasoFontana',    email: 'tommaso.fontana@example.com',    createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 258.5,  weeklyPoints: 29.5,  rank: 28, paidWeeks: 37 },
  { id: 'p29', username: 'EnricoSantoro',     email: 'enrico.santoro@example.com',     createdAt: '2025-08-22T00:00:00.000Z', isActive: true,  totalPoints: 246.8,  weeklyPoints: 37.2,  rank: 29, paidWeeks: 36 },
  { id: 'p30', username: 'PietroMariani',     email: 'pietro.mariani@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 235.2,  weeklyPoints: 24.8,  rank: 30, paidWeeks: 37 },
  { id: 'p31', username: 'AlessioRossi',      email: 'alessio.rossi@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 223.5,  weeklyPoints: 38.5,  rank: 31, paidWeeks: 37 },
  { id: 'p32', username: 'FilippoBianchi',    email: 'filippo.bianchi@example.com',    createdAt: '2025-09-01T00:00:00.000Z', isActive: true,  totalPoints: 211.8,  weeklyPoints: 27.2,  rank: 32, paidWeeks: 35 },
  { id: 'p33', username: 'EdoardoVerdi',      email: 'edoardo.verdi@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 200.2,  weeklyPoints: 32.8,  rank: 33, paidWeeks: 37 },
  { id: 'p34', username: 'LeonardoNeri',      email: 'leonardo.neri@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 188.5,  weeklyPoints: 25.5,  rank: 34, paidWeeks: 37 },
  { id: 'p35', username: 'TommasoGialli',     email: 'tommaso.gialli@example.com',     createdAt: '2025-08-25T00:00:00.000Z', isActive: true,  totalPoints: 176.8,  weeklyPoints: 39.5,  rank: 35, paidWeeks: 36 },
  { id: 'p36', username: 'GiacomoBlu',        email: 'giacomo.blu@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 165.2,  weeklyPoints: 23.8,  rank: 36, paidWeeks: 37 },
  { id: 'p37', username: 'AlessandroViola',   email: 'alessandro.viola@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 153.5,  weeklyPoints: 36.2,  rank: 37, paidWeeks: 37 },
  { id: 'p38', username: 'MattiaArancio',     email: 'mattia.arancio@example.com',     createdAt: '2025-09-08T00:00:00.000Z', isActive: true,  totalPoints: 141.8,  weeklyPoints: 28.5,  rank: 38, paidWeeks: 34 },
  { id: 'p39', username: 'RiccardoEsposito',  email: 'riccardo.esposito@example.com',  createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 130.2,  weeklyPoints: 31.8,  rank: 39, paidWeeks: 37 },
  { id: 'p40', username: 'LorenzoRusso',      email: 'lorenzo.russo@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 118.5,  weeklyPoints: 24.2,  rank: 40, paidWeeks: 37 },
  { id: 'p41', username: 'GabrielFerrari',    email: 'gabriel.ferrari@example.com',    createdAt: '2025-08-28T00:00:00.000Z', isActive: true,  totalPoints: 106.8,  weeklyPoints: 37.5,  rank: 41, paidWeeks: 36 },
  { id: 'p42', username: 'NicolaRomano',      email: 'nicola.romano@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  95.2,  weeklyPoints: 22.8,  rank: 42, paidWeeks: 37 },
  { id: 'p43', username: 'DiegoColomb',       email: 'diego.colombo@example.com',      createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  83.5,  weeklyPoints: 34.2,  rank: 43, paidWeeks: 37 },
  { id: 'p44', username: 'SamuelRicci',       email: 'samuel.ricci@example.com',       createdAt: '2025-09-15T00:00:00.000Z', isActive: true,  totalPoints:  71.8,  weeklyPoints: 26.5,  rank: 44, paidWeeks: 32 },
  { id: 'p45', username: 'ChristianMarino',   email: 'christian.marino@example.com',   createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  60.2,  weeklyPoints: 30.8,  rank: 45, paidWeeks: 37 },
  { id: 'p46', username: 'KevinGreco',        email: 'kevin.greco@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  48.5,  weeklyPoints: 21.5,  rank: 46, paidWeeks: 37 },
  { id: 'p47', username: 'BryanBruno',        email: 'bryan.bruno@example.com',        createdAt: '2025-08-30T00:00:00.000Z', isActive: false, totalPoints:  36.8,  weeklyPoints:  0.0,  rank: 47, paidWeeks: 20 },
  { id: 'p48', username: 'JonathanGallo',     email: 'jonathan.gallo@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  25.2,  weeklyPoints: 35.5,  rank: 48, paidWeeks: 37 },
  { id: 'p49', username: 'AlexConti',         email: 'alex.conti@example.com',         createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints:  13.5,  weeklyPoints: 19.5,  rank: 49, paidWeeks: 37 },
  { id: 'p50', username: 'ChrisDeLuca',       email: 'chris.deluca@example.com',       createdAt: '2025-10-01T00:00:00.000Z', isActive: true,  totalPoints:   8.2,  weeklyPoints: 28.2,  rank: 50, paidWeeks: 18 },
  { id: 'p51', username: 'DennisMancini',     email: 'dennis.mancini@example.com',     createdAt: '2025-08-15T00:00:00.000Z', isActive: false, totalPoints: 459.2,  weeklyPoints:  0.0,  rank: 51, paidWeeks: 35 },
  { id: 'p52', username: 'JasonCosta',        email: 'jason.costa@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 387.5,  weeklyPoints: 33.2,  rank: 52, paidWeeks: 37 },
  { id: 'p53', username: 'BrandonGiordano',   email: 'brandon.giordano@example.com',   createdAt: '2025-09-12T00:00:00.000Z', isActive: true,  totalPoints: 295.8,  weeklyPoints: 29.8,  rank: 53, paidWeeks: 33 },
  { id: 'p54', username: 'TylerRizzo',        email: 'tyler.rizzo@example.com',        createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 224.2,  weeklyPoints: 36.5,  rank: 54, paidWeeks: 37 },
  { id: 'p55', username: 'JustinLombardi',    email: 'justin.lombardi@example.com',    createdAt: '2025-08-15T00:00:00.000Z', isActive: true,  totalPoints: 152.5,  weeklyPoints: 24.8,  rank: 55, paidWeeks: 37 },
].sort((a, b) => b.totalPoints - a.totalPoints).map((p, idx) => ({ ...p, rank: idx + 1, coins: 0, coinsEarned: 0 }));

// Classifica di esempio
export const MOCK_RANKINGS: RankingEntry[] = MOCK_PARTICIPANTS
  .sort((a, b) => b.totalPoints - a.totalPoints)
  .map((p, index) => ({
    rank: index + 1,
    participantId: p.id,
    username: p.username,
    totalPoints: p.totalPoints,
    matchdaysPlayed: 17,
    correctPredictions: Math.floor(p.totalPoints * 2.5),
    averagePointsPerMatchday: Math.round((p.totalPoints / 17) * 100) / 100,
    bestMatchdayPoints: Math.round((Math.random() * 5 + 8) * 100) / 100,
    perfectSchedine: index === 0 ? 1 : 0,
    bonusPointsTotal: Math.floor(Math.random() * 8),
    penaltyPointsTotal: Math.floor(Math.random() * 3) * -1.5,
    weeklyWins: Math.floor(Math.random() * 4),
  }));

// Struttura quote complete per ogni partita
export interface MatchOdds {
  esito: { '1': number; 'X': number; '2': number };
  over_under: { 'OVER': number; 'UNDER': number };
  goal_nogoal: { 'GG': number; 'NG': number };
  doppia_chance: { '1X': number; '12': number; 'X2': number };
  multigoal: { 'O0.5': number; 'U0.5': number; 'O1.5': number; 'U1.5': number; 'O2.5': number; 'U2.5': number; 'O3.5': number; 'U3.5': number };
  esito_1t: { '1': number; 'X': number; '2': number };
  over_under_1t: { 'OVER': number; 'UNDER': number };
  goal_nogoal_1t: { 'GG': number; 'NG': number };
}

// Quote di esempio per le partite (10 partite con tutti i mercati incluso 1° tempo)
export const MOCK_ODDS: Record<string, MatchOdds> = {
  'm1': { // Napoli - Juventus
    esito: { '1': 2.45, 'X': 3.20, '2': 2.90 },
    over_under: { 'OVER': 1.85, 'UNDER': 1.95 },
    goal_nogoal: { 'GG': 1.75, 'NG': 2.05 },
    doppia_chance: { '1X': 1.40, '12': 1.35, 'X2': 1.52 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.85, 'U2.5': 1.95, 'O3.5': 2.60, 'U3.5': 1.48 },
    esito_1t: { '1': 3.20, 'X': 1.90, '2': 4.10 },
    over_under_1t: { 'OVER': 2.45, 'UNDER': 1.55 },
    goal_nogoal_1t: { 'GG': 2.90, 'NG': 1.40 },
  },
  'm2': { // Inter - Milan
    esito: { '1': 1.85, 'X': 3.60, '2': 4.20 },
    over_under: { 'OVER': 1.70, 'UNDER': 2.10 },
    goal_nogoal: { 'GG': 1.65, 'NG': 2.20 },
    doppia_chance: { '1X': 1.25, '12': 1.40, 'X2': 1.90 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.28, 'U1.5': 3.50, 'O2.5': 1.70, 'U2.5': 2.10, 'O3.5': 2.40, 'U3.5': 1.55 },
    esito_1t: { '1': 2.60, 'X': 1.92, '2': 5.50 },
    over_under_1t: { 'OVER': 2.20, 'UNDER': 1.65 },
    goal_nogoal_1t: { 'GG': 2.75, 'NG': 1.45 },
  },
  'm3': { // Atalanta - Lazio
    esito: { '1': 1.75, 'X': 3.80, '2': 4.50 },
    over_under: { 'OVER': 1.60, 'UNDER': 2.25 },
    goal_nogoal: { 'GG': 1.55, 'NG': 2.40 },
    doppia_chance: { '1X': 1.22, '12': 1.38, 'X2': 2.00 },
    multigoal: { 'O0.5': 1.05, 'U0.5': 8.00, 'O1.5': 1.22, 'U1.5': 4.00, 'O2.5': 1.60, 'U2.5': 2.25, 'O3.5': 2.20, 'U3.5': 1.65 },
    esito_1t: { '1': 2.40, 'X': 1.88, '2': 6.00 },
    over_under_1t: { 'OVER': 2.05, 'UNDER': 1.75 },
    goal_nogoal_1t: { 'GG': 2.60, 'NG': 1.50 },
  },
  'm4': { // Roma - Fiorentina
    esito: { '1': 2.10, 'X': 3.40, '2': 3.50 },
    over_under: { 'OVER': 1.80, 'UNDER': 2.00 },
    goal_nogoal: { 'GG': 1.70, 'NG': 2.10 },
    doppia_chance: { '1X': 1.32, '12': 1.38, 'X2': 1.72 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.30, 'U1.5': 3.30, 'O2.5': 1.80, 'U2.5': 2.00, 'O3.5': 2.50, 'U3.5': 1.52 },
    esito_1t: { '1': 2.90, 'X': 1.95, '2': 4.50 },
    over_under_1t: { 'OVER': 2.35, 'UNDER': 1.58 },
    goal_nogoal_1t: { 'GG': 2.80, 'NG': 1.42 },
  },
  'm5': { // Bologna - Torino
    esito: { '1': 2.30, 'X': 3.30, '2': 3.10 },
    over_under: { 'OVER': 1.90, 'UNDER': 1.90 },
    goal_nogoal: { 'GG': 1.80, 'NG': 2.00 },
    doppia_chance: { '1X': 1.38, '12': 1.35, 'X2': 1.58 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.90, 'U2.5': 1.90, 'O3.5': 2.70, 'U3.5': 1.45 },
    esito_1t: { '1': 3.10, 'X': 1.92, '2': 4.20 },
    over_under_1t: { 'OVER': 2.50, 'UNDER': 1.52 },
    goal_nogoal_1t: { 'GG': 3.00, 'NG': 1.38 },
  },
  'm6': { // Udinese - Empoli
    esito: { '1': 2.00, 'X': 3.40, '2': 3.80 },
    over_under: { 'OVER': 2.00, 'UNDER': 1.80 },
    goal_nogoal: { 'GG': 1.95, 'NG': 1.85 },
    doppia_chance: { '1X': 1.30, '12': 1.42, 'X2': 1.78 },
    multigoal: { 'O0.5': 1.12, 'U0.5': 6.00, 'O1.5': 1.40, 'U1.5': 2.90, 'O2.5': 2.00, 'U2.5': 1.80, 'O3.5': 2.90, 'U3.5': 1.40 },
    esito_1t: { '1': 2.70, 'X': 1.95, '2': 5.00 },
    over_under_1t: { 'OVER': 2.60, 'UNDER': 1.48 },
    goal_nogoal_1t: { 'GG': 3.10, 'NG': 1.36 },
  },
  'm7': { // Genoa - Cagliari
    esito: { '1': 2.20, 'X': 3.30, '2': 3.30 },
    over_under: { 'OVER': 1.95, 'UNDER': 1.85 },
    goal_nogoal: { 'GG': 1.85, 'NG': 1.95 },
    doppia_chance: { '1X': 1.35, '12': 1.38, 'X2': 1.65 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.38, 'U1.5': 3.00, 'O2.5': 1.95, 'U2.5': 1.85, 'O3.5': 2.80, 'U3.5': 1.42 },
    esito_1t: { '1': 3.00, 'X': 1.92, '2': 4.40 },
    over_under_1t: { 'OVER': 2.55, 'UNDER': 1.50 },
    goal_nogoal_1t: { 'GG': 3.05, 'NG': 1.37 },
  },
  'm8': { // Verona - Lecce
    esito: { '1': 2.50, 'X': 3.20, '2': 2.85 },
    over_under: { 'OVER': 1.88, 'UNDER': 1.92 },
    goal_nogoal: { 'GG': 1.78, 'NG': 2.02 },
    doppia_chance: { '1X': 1.42, '12': 1.35, 'X2': 1.52 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.88, 'U2.5': 1.92, 'O3.5': 2.65, 'U3.5': 1.48 },
    esito_1t: { '1': 3.30, 'X': 1.88, '2': 4.00 },
    over_under_1t: { 'OVER': 2.45, 'UNDER': 1.55 },
    goal_nogoal_1t: { 'GG': 2.95, 'NG': 1.40 },
  },
  'm9': { // Parma - Como
    esito: { '1': 2.15, 'X': 3.40, '2': 3.40 },
    over_under: { 'OVER': 1.82, 'UNDER': 1.98 },
    goal_nogoal: { 'GG': 1.72, 'NG': 2.08 },
    doppia_chance: { '1X': 1.33, '12': 1.40, 'X2': 1.70 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.32, 'U1.5': 3.25, 'O2.5': 1.82, 'U2.5': 1.98, 'O3.5': 2.55, 'U3.5': 1.50 },
    esito_1t: { '1': 2.95, 'X': 1.90, '2': 4.60 },
    over_under_1t: { 'OVER': 2.40, 'UNDER': 1.56 },
    goal_nogoal_1t: { 'GG': 2.85, 'NG': 1.42 },
  },
  'm10': { // Monza - Venezia
    esito: { '1': 2.40, 'X': 3.25, '2': 2.95 },
    over_under: { 'OVER': 1.92, 'UNDER': 1.88 },
    goal_nogoal: { 'GG': 1.82, 'NG': 1.98 },
    doppia_chance: { '1X': 1.40, '12': 1.35, 'X2': 1.55 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.36, 'U1.5': 3.05, 'O2.5': 1.92, 'U2.5': 1.88, 'O3.5': 2.72, 'U3.5': 1.45 },
    esito_1t: { '1': 3.15, 'X': 1.90, '2': 4.25 },
    over_under_1t: { 'OVER': 2.50, 'UNDER': 1.52 },
    goal_nogoal_1t: { 'GG': 2.98, 'NG': 1.38 },
  },
};
