// ============================================
// FANTA SCHEDINA - DATI DI ESEMPIO
// ============================================

import type { Match, Participant, RankingEntry, Team } from '@/types';

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

// Partite Giornata 18 (15 partite)
export const MOCK_MATCHES: Match[] = [
  { id: 'm1', matchday: 18, homeTeam: getTeam('nap'), awayTeam: getTeam('juv'), scheduledAt: new Date('2026-02-01T15:00:00'), status: 'scheduled' },
  { id: 'm2', matchday: 18, homeTeam: getTeam('int'), awayTeam: getTeam('mil'), scheduledAt: new Date('2026-02-01T18:00:00'), status: 'scheduled' },
  { id: 'm3', matchday: 18, homeTeam: getTeam('ata'), awayTeam: getTeam('laz'), scheduledAt: new Date('2026-02-01T20:45:00'), status: 'scheduled' },
  { id: 'm4', matchday: 18, homeTeam: getTeam('rom'), awayTeam: getTeam('fio'), scheduledAt: new Date('2026-02-02T12:30:00'), status: 'scheduled' },
  { id: 'm5', matchday: 18, homeTeam: getTeam('bol'), awayTeam: getTeam('tor'), scheduledAt: new Date('2026-02-02T15:00:00'), status: 'scheduled' },
  { id: 'm6', matchday: 18, homeTeam: getTeam('udi'), awayTeam: getTeam('emp'), scheduledAt: new Date('2026-02-02T15:00:00'), status: 'scheduled' },
  { id: 'm7', matchday: 18, homeTeam: getTeam('gen'), awayTeam: getTeam('cag'), scheduledAt: new Date('2026-02-02T15:00:00'), status: 'scheduled' },
  { id: 'm8', matchday: 18, homeTeam: getTeam('ver'), awayTeam: getTeam('lec'), scheduledAt: new Date('2026-02-02T18:00:00'), status: 'scheduled' },
  { id: 'm9', matchday: 18, homeTeam: getTeam('par'), awayTeam: getTeam('com'), scheduledAt: new Date('2026-02-02T18:00:00'), status: 'scheduled' },
  { id: 'm10', matchday: 18, homeTeam: getTeam('mon'), awayTeam: getTeam('ven'), scheduledAt: new Date('2026-02-02T20:45:00'), status: 'scheduled' },
  { id: 'm11', matchday: 18, homeTeam: getTeam('juv'), awayTeam: getTeam('int'), scheduledAt: new Date('2026-02-03T15:00:00'), status: 'scheduled' },
  { id: 'm12', matchday: 18, homeTeam: getTeam('mil'), awayTeam: getTeam('nap'), scheduledAt: new Date('2026-02-03T18:00:00'), status: 'scheduled' },
  { id: 'm13', matchday: 18, homeTeam: getTeam('laz'), awayTeam: getTeam('rom'), scheduledAt: new Date('2026-02-03T20:45:00'), status: 'scheduled' },
  { id: 'm14', matchday: 18, homeTeam: getTeam('fio'), awayTeam: getTeam('ata'), scheduledAt: new Date('2026-02-04T18:00:00'), status: 'scheduled' },
  { id: 'm15', matchday: 18, homeTeam: getTeam('tor'), awayTeam: getTeam('bol'), scheduledAt: new Date('2026-02-04T20:45:00'), status: 'scheduled' },
];

// Partecipanti di esempio
export const MOCK_PARTICIPANTS: Participant[] = [
  {
    id: 'p1',
    username: 'MarioRossi',
    email: 'mario@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 42.5,
    weeklyPoints: 5.2,
    rank: 1,
    paidWeeks: 17,
  },
  {
    id: 'p2',
    username: 'LucaBianchi',
    email: 'luca@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 38.2,
    weeklyPoints: 4.8,
    rank: 2,
    paidWeeks: 17,
  },
  {
    id: 'p3',
    username: 'GiuseppeVerdi',
    email: 'giuseppe@example.com',
    createdAt: '2025-09-01T00:00:00.000Z',
    isActive: true,
    totalPoints: 35.8,
    weeklyPoints: 3.9,
    rank: 3,
    paidWeeks: 15,
  },
  {
    id: 'p4',
    username: 'AntonioNeri',
    email: 'antonio@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 34.1,
    weeklyPoints: 4.1,
    rank: 4,
    paidWeeks: 17,
  },
  {
    id: 'p5',
    username: 'FrancescoGialli',
    email: 'francesco@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 31.9,
    weeklyPoints: 3.5,
    rank: 5,
    paidWeeks: 17,
  },
  {
    id: 'p6',
    username: 'AlessandroBlù',
    email: 'alessandro@example.com',
    createdAt: '2025-08-20T00:00:00.000Z',
    isActive: true,
    totalPoints: 29.7,
    weeklyPoints: 3.2,
    rank: 6,
    paidWeeks: 16,
  },
  {
    id: 'p7',
    username: 'MarcoViola',
    email: 'marco@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 28.4,
    weeklyPoints: 2.9,
    rank: 7,
    paidWeeks: 17,
  },
  {
    id: 'p8',
    username: 'DavideArancio',
    email: 'davide@example.com',
    createdAt: '2025-08-15T00:00:00.000Z',
    isActive: true,
    totalPoints: 26.2,
    weeklyPoints: 2.5,
    rank: 8,
    paidWeeks: 17,
  },
];

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
}

// Quote di esempio per le partite (15 partite con tutti i mercati)
export const MOCK_ODDS: Record<string, MatchOdds> = {
  'm1': { // Napoli - Juventus
    esito: { '1': 2.45, 'X': 3.20, '2': 2.90 },
    over_under: { 'OVER': 1.85, 'UNDER': 1.95 },
    goal_nogoal: { 'GG': 1.75, 'NG': 2.05 },
    doppia_chance: { '1X': 1.40, '12': 1.35, 'X2': 1.52 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.85, 'U2.5': 1.95, 'O3.5': 2.60, 'U3.5': 1.48 },
  },
  'm2': { // Inter - Milan
    esito: { '1': 1.85, 'X': 3.60, '2': 4.20 },
    over_under: { 'OVER': 1.70, 'UNDER': 2.10 },
    goal_nogoal: { 'GG': 1.65, 'NG': 2.20 },
    doppia_chance: { '1X': 1.25, '12': 1.40, 'X2': 1.90 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.28, 'U1.5': 3.50, 'O2.5': 1.70, 'U2.5': 2.10, 'O3.5': 2.40, 'U3.5': 1.55 },
  },
  'm3': { // Atalanta - Lazio
    esito: { '1': 1.75, 'X': 3.80, '2': 4.50 },
    over_under: { 'OVER': 1.60, 'UNDER': 2.25 },
    goal_nogoal: { 'GG': 1.55, 'NG': 2.40 },
    doppia_chance: { '1X': 1.22, '12': 1.38, 'X2': 2.00 },
    multigoal: { 'O0.5': 1.05, 'U0.5': 8.00, 'O1.5': 1.22, 'U1.5': 4.00, 'O2.5': 1.60, 'U2.5': 2.25, 'O3.5': 2.20, 'U3.5': 1.65 },
  },
  'm4': { // Roma - Fiorentina
    esito: { '1': 2.10, 'X': 3.40, '2': 3.50 },
    over_under: { 'OVER': 1.80, 'UNDER': 2.00 },
    goal_nogoal: { 'GG': 1.70, 'NG': 2.10 },
    doppia_chance: { '1X': 1.32, '12': 1.38, 'X2': 1.72 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.30, 'U1.5': 3.30, 'O2.5': 1.80, 'U2.5': 2.00, 'O3.5': 2.50, 'U3.5': 1.52 },
  },
  'm5': { // Bologna - Torino
    esito: { '1': 2.30, 'X': 3.30, '2': 3.10 },
    over_under: { 'OVER': 1.90, 'UNDER': 1.90 },
    goal_nogoal: { 'GG': 1.80, 'NG': 2.00 },
    doppia_chance: { '1X': 1.38, '12': 1.35, 'X2': 1.58 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.90, 'U2.5': 1.90, 'O3.5': 2.70, 'U3.5': 1.45 },
  },
  'm6': { // Udinese - Empoli
    esito: { '1': 2.00, 'X': 3.40, '2': 3.80 },
    over_under: { 'OVER': 2.00, 'UNDER': 1.80 },
    goal_nogoal: { 'GG': 1.95, 'NG': 1.85 },
    doppia_chance: { '1X': 1.30, '12': 1.42, 'X2': 1.78 },
    multigoal: { 'O0.5': 1.12, 'U0.5': 6.00, 'O1.5': 1.40, 'U1.5': 2.90, 'O2.5': 2.00, 'U2.5': 1.80, 'O3.5': 2.90, 'U3.5': 1.40 },
  },
  'm7': { // Genoa - Cagliari
    esito: { '1': 2.20, 'X': 3.30, '2': 3.30 },
    over_under: { 'OVER': 1.95, 'UNDER': 1.85 },
    goal_nogoal: { 'GG': 1.85, 'NG': 1.95 },
    doppia_chance: { '1X': 1.35, '12': 1.38, 'X2': 1.65 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.38, 'U1.5': 3.00, 'O2.5': 1.95, 'U2.5': 1.85, 'O3.5': 2.80, 'U3.5': 1.42 },
  },
  'm8': { // Verona - Lecce
    esito: { '1': 2.50, 'X': 3.20, '2': 2.85 },
    over_under: { 'OVER': 1.88, 'UNDER': 1.92 },
    goal_nogoal: { 'GG': 1.78, 'NG': 2.02 },
    doppia_chance: { '1X': 1.42, '12': 1.35, 'X2': 1.52 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.88, 'U2.5': 1.92, 'O3.5': 2.65, 'U3.5': 1.48 },
  },
  'm9': { // Parma - Como
    esito: { '1': 2.15, 'X': 3.40, '2': 3.40 },
    over_under: { 'OVER': 1.82, 'UNDER': 1.98 },
    goal_nogoal: { 'GG': 1.72, 'NG': 2.08 },
    doppia_chance: { '1X': 1.33, '12': 1.40, 'X2': 1.70 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.32, 'U1.5': 3.25, 'O2.5': 1.82, 'U2.5': 1.98, 'O3.5': 2.55, 'U3.5': 1.50 },
  },
  'm10': { // Monza - Venezia
    esito: { '1': 2.40, 'X': 3.25, '2': 2.95 },
    over_under: { 'OVER': 1.92, 'UNDER': 1.88 },
    goal_nogoal: { 'GG': 1.82, 'NG': 1.98 },
    doppia_chance: { '1X': 1.40, '12': 1.35, 'X2': 1.55 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.36, 'U1.5': 3.05, 'O2.5': 1.92, 'U2.5': 1.88, 'O3.5': 2.72, 'U3.5': 1.45 },
  },
  'm11': { // Juventus - Inter
    esito: { '1': 2.70, 'X': 3.15, '2': 2.65 },
    over_under: { 'OVER': 1.75, 'UNDER': 2.05 },
    goal_nogoal: { 'GG': 1.68, 'NG': 2.15 },
    doppia_chance: { '1X': 1.45, '12': 1.35, 'X2': 1.45 },
    multigoal: { 'O0.5': 1.07, 'U0.5': 7.50, 'O1.5': 1.28, 'U1.5': 3.50, 'O2.5': 1.75, 'U2.5': 2.05, 'O3.5': 2.45, 'U3.5': 1.55 },
  },
  'm12': { // Milan - Napoli
    esito: { '1': 2.55, 'X': 3.20, '2': 2.80 },
    over_under: { 'OVER': 1.78, 'UNDER': 2.02 },
    goal_nogoal: { 'GG': 1.70, 'NG': 2.10 },
    doppia_chance: { '1X': 1.42, '12': 1.35, 'X2': 1.50 },
    multigoal: { 'O0.5': 1.08, 'U0.5': 7.00, 'O1.5': 1.30, 'U1.5': 3.35, 'O2.5': 1.78, 'U2.5': 2.02, 'O3.5': 2.50, 'U3.5': 1.52 },
  },
  'm13': { // Lazio - Roma (Derby)
    esito: { '1': 2.35, 'X': 3.25, '2': 3.05 },
    over_under: { 'OVER': 1.72, 'UNDER': 2.08 },
    goal_nogoal: { 'GG': 1.65, 'NG': 2.20 },
    doppia_chance: { '1X': 1.38, '12': 1.35, 'X2': 1.58 },
    multigoal: { 'O0.5': 1.06, 'U0.5': 7.50, 'O1.5': 1.25, 'U1.5': 3.60, 'O2.5': 1.72, 'U2.5': 2.08, 'O3.5': 2.38, 'U3.5': 1.58 },
  },
  'm14': { // Fiorentina - Atalanta
    esito: { '1': 3.20, 'X': 3.30, '2': 2.25 },
    over_under: { 'OVER': 1.65, 'UNDER': 2.20 },
    goal_nogoal: { 'GG': 1.58, 'NG': 2.30 },
    doppia_chance: { '1X': 1.62, '12': 1.35, 'X2': 1.38 },
    multigoal: { 'O0.5': 1.06, 'U0.5': 7.50, 'O1.5': 1.24, 'U1.5': 3.80, 'O2.5': 1.65, 'U2.5': 2.20, 'O3.5': 2.30, 'U3.5': 1.62 },
  },
  'm15': { // Torino - Bologna
    esito: { '1': 2.60, 'X': 3.20, '2': 2.75 },
    over_under: { 'OVER': 1.88, 'UNDER': 1.92 },
    goal_nogoal: { 'GG': 1.80, 'NG': 2.00 },
    doppia_chance: { '1X': 1.45, '12': 1.35, 'X2': 1.48 },
    multigoal: { 'O0.5': 1.10, 'U0.5': 6.50, 'O1.5': 1.35, 'U1.5': 3.10, 'O2.5': 1.88, 'U2.5': 1.92, 'O3.5': 2.65, 'U3.5': 1.48 },
  },
};
