// ============================================
// FANTA SCHEDINA - GAME API (Cloud Functions callables)
// Tutte le azioni che toccano punti/gettoni passano dal server.
// ============================================

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Prediction } from '@/types';
import type { PowerUpSelection } from './economy';
import type { PenaltyZone } from './penalty';

export interface SubmitSchedinaResponse {
  ok: boolean;
  matchday: number;
  leagueId: string | null;
  coinsSpent: number;
}

/**
 * `leagueId` sceglie il circuito: assente = classifica generale, altrimenti la
 * schedina vale solo per quella lega. Sono schedine distinte sulla stessa
 * giornata, ognuna con i propri power-up.
 */
export async function submitSchedinaFn(
  predictions: Prediction[],
  powerups: PowerUpSelection = {},
  leagueId?: string | null
): Promise<SubmitSchedinaResponse> {
  const fn = httpsCallable<
    { predictions: Prediction[]; powerups: PowerUpSelection; leagueId?: string | null },
    SubmitSchedinaResponse
  >(functions, 'submitSchedina');
  const res = await fn({ predictions, powerups, leagueId: leagueId ?? null });
  return res.data;
}

export async function changePredictionFn(
  matchId: string,
  betType: string,
  outcome: string,
  leagueId?: string | null
): Promise<{ ok: boolean; coinsSpent: number }> {
  const fn = httpsCallable<
    { matchId: string; betType: string; outcome: string; leagueId?: string | null },
    { ok: boolean; coinsSpent: number }
  >(functions, 'changePrediction');
  const res = await fn({ matchId, betType, outcome, leagueId: leagueId ?? null });
  return res.data;
}

export async function cancelSchedinaFn(
  leagueId?: string | null
): Promise<{ ok: boolean; refund: boolean }> {
  const fn = httpsCallable<{ leagueId?: string | null }, { ok: boolean; refund: boolean }>(
    functions,
    'cancelSchedina'
  );
  const res = await fn({ leagueId: leagueId ?? null });
  return res.data;
}

// --- MINIGIOCHI ---

export interface QuizQuestionPublic {
  id: string;
  question: string;
  options: string[];
}

export async function startQuiz(): Promise<{ questions: QuizQuestionPublic[] }> {
  const fn = httpsCallable<{ action: string }, { questions: QuizQuestionPublic[] }>(
    functions,
    'playMinigame'
  );
  const res = await fn({ action: 'quiz_start' });
  return res.data;
}

export async function submitQuiz(answers: Record<string, number>): Promise<{
  correct: number;
  total: number;
  reward: number;
  corrections: Record<string, number>;
}> {
  const fn = httpsCallable<
    { action: string; answers: Record<string, number> },
    { correct: number; total: number; reward: number; corrections: Record<string, number> }
  >(functions, 'playMinigame');
  const res = await fn({ action: 'quiz_submit', answers });
  return res.data;
}

export async function spinWheel(): Promise<{ segmentIndex: number; reward: number }> {
  const fn = httpsCallable<{ action: string }, { segmentIndex: number; reward: number }>(
    functions,
    'playMinigame'
  );
  const res = await fn({ action: 'wheel_spin' });
  return res.data;
}

export interface PenaltyShotInput {
  zone: PenaltyZone;
  power: number;
}

export interface RigoriShot {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  goal: boolean;
  power: number;
}

export async function playRigori(shots: PenaltyShotInput[]): Promise<{
  results: RigoriShot[];
  goals: number;
  reward: number;
}> {
  const fn = httpsCallable<
    { action: string; shots: PenaltyShotInput[] },
    { results: RigoriShot[]; goals: number; reward: number }
  >(functions, 'playMinigame');
  const res = await fn({ action: 'rigori_play', shots });
  return res.data;
}

// --- MEMORIA CALCIO ---

export interface MemoriaPlayResponse {
  levelsCompleted: number;
  timeRemaining: number;
  reward: number;
  levelReward: number;
  timeBonus: number;
}

export async function playMemoria(levelsCompleted: number, timeRemaining: number): Promise<MemoriaPlayResponse> {
  const fn = httpsCallable<
    { action: string; levelsCompleted: number; timeRemaining: number },
    MemoriaPlayResponse
  >(functions, 'playMinigame');
  const res = await fn({ action: 'memoria_play', levelsCompleted, timeRemaining });
  return res.data;
}

// --- SFIDE 1VS1 ---

export interface SfidaStartResponse {
  opponent: {
    uid: string;
    displayName: string;
  };
  myCoins: number;
}

export interface SfidaPlayResponse {
  myResults: RigoriShot[];
  oppResults: RigoriShot[];
  myGoals: number;
  oppGoals: number;
  won: boolean;
  draw: boolean;
  reward: number;
}

export async function startSfida(opponentId: string): Promise<SfidaStartResponse> {
  const fn = httpsCallable<{ action: string; opponentId: string }, SfidaStartResponse>(
    functions,
    'playMinigame'
  );
  const res = await fn({ action: 'sfida_start', opponentId });
  return res.data;
}

export async function playSfida(opponentId: string, shots: PenaltyShotInput[]): Promise<SfidaPlayResponse> {
  const fn = httpsCallable<
    { action: string; opponentId: string; shots: PenaltyShotInput[] },
    SfidaPlayResponse
  >(functions, 'playMinigame');
  const res = await fn({ action: 'sfida_play', opponentId, shots });
  return res.data;
}

// --- SEED QUIZ (admin one-time) ---

export async function seedQuizQuestionsFn(): Promise<{ message: string; count: number }> {
  const fn = httpsCallable<Record<string, never>, { message: string; count: number }>(
    functions,
    'seedQuizQuestions'
  );
  const res = await fn({});
  return res.data;
}

// --- MISSIONI ---

export async function claimMissionFn(
  missionId: string
): Promise<{ ok: boolean; reward: number }> {
  const fn = httpsCallable<{ missionId: string }, { ok: boolean; reward: number }>(
    functions,
    'claimMission'
  );
  const res = await fn({ missionId });
  return res.data;
}

export interface PublicProfileData {
  id: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  weeklyPoints: number;
  matchdaysPlayed: number;
  perfectSchedine: number;
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
  bestMatchdayPoints: number;
  correctPredictions: number;
  isActive?: boolean;
}

export interface RankingRow {
  rank: number;
  participantId: string;
  username: string;
  totalPoints: number;
  matchdaysPlayed: number;
  correctPredictions: number;
  averagePointsPerMatchday: number;
  bestMatchdayPoints: number;
  perfectSchedine: number;
  bonusPointsTotal: number;
  penaltyPointsTotal: number;
  weeklyWins: number;
}

/** Classifica calcolata dal server. Con `leagueId` è ristretta a quella lega. */
export async function getRankingsFn(
  leagueId?: string
): Promise<{ rankings: RankingRow[] }> {
  const fn = httpsCallable<{ leagueId?: string }, { rankings: RankingRow[] }>(
    functions,
    'getRankings'
  );
  const res = await fn(leagueId ? { leagueId } : {});
  return res.data;
}

export async function getPublicProfilesFn(
  pageSize?: number,
  cursor?: string
): Promise<{ profiles: PublicProfileData[]; nextCursor: string | null }> {
  const fn = httpsCallable<
    { pageSize?: number; cursor?: string },
    { profiles: PublicProfileData[]; nextCursor: string | null }
  >(functions, 'getPublicProfiles');
  const res = await fn({ pageSize, cursor });
  return res.data;
}

type LeagueAction = 'create' | 'joinByCode' | 'joinPublic' | 'leave' | 'delete';

export async function manageLeagueFn(
  action: LeagueAction,
  data: Record<string, unknown> = {}
): Promise<{ ok: boolean; leagueId: string }> {
  const fn = httpsCallable<
    { action: LeagueAction } & Record<string, unknown>,
    { ok: boolean; leagueId: string }
  >(functions, 'manageLeague');
  const res = await fn({ action, ...data });
  return res.data;
}

// --- RIGORI DUELLO REALTIME ---

export type PenaltyTarget = 'left' | 'center' | 'right';
export type DuelMode = 'human' | 'botAttacker' | 'botKeeper' | 'botAlternate';

export interface PenaltyDuelState {
  id: string;
  code: string;
  p1: { uid: string; username: string; score: number };
  p2: { uid: string; username: string; score: number; isBot?: boolean };
  mode: DuelMode;
  round: number;
  attacker: 1 | 2;
  p1Choice: PenaltyTarget | null;
  p2Choice: PenaltyTarget | null;
  phase: 'waiting' | 'playing' | 'finished';
  startedAt: number;
  deadlineAt: number;
  winner: 1 | 2 | 'draw' | null;
  /** Chiusa dalla pulizia perché nessuno ha più giocato: non è una sconfitta. */
  abandoned?: boolean;
  reward: number;
  lastRound: {
    round: number;
    attacker: 1 | 2;
    p1Choice: PenaltyTarget;
    p2Choice: PenaltyTarget;
    goal: boolean;
    p1Score: number;
    p2Score: number;
  } | null;
}

export async function createPenaltyDuelFn(): Promise<{ duelId: string; code: string }> {
  const fn = httpsCallable<Record<string, never>, { duelId: string; code: string }>(
    functions,
    'managePenaltyDuel'
  );
  const res = await fn({ action: 'create' } as unknown as Record<string, never>);
  return res.data;
}

export async function joinPenaltyDuelFn(code: string): Promise<{ duelId: string }> {
  const fn = httpsCallable<{ action: string; code: string }, { duelId: string }>(
    functions,
    'managePenaltyDuel'
  );
  const res = await fn({ action: 'join', code });
  return res.data;
}

export async function createPenaltyDuelBotFn(mode: Exclude<DuelMode, 'human'>): Promise<{ duelId: string }> {
  const fn = httpsCallable<{ action: string; mode: string }, { duelId: string }>(
    functions,
    'managePenaltyDuel'
  );
  const res = await fn({ action: 'bot', mode });
  return res.data;
}

export async function penaltyDuelMoveFn(
  duelId: string,
  target?: PenaltyTarget,
  timeout = false
): Promise<{
  ok: boolean;
  resolved: boolean;
  finished?: boolean;
  winner?: 1 | 2 | 'draw';
  p1Score?: number;
  p2Score?: number;
  reward?: number;
  goal?: boolean;
}> {
  const fn = httpsCallable<
    { action: string; duelId: string; target?: PenaltyTarget; timeout?: boolean },
    {
      ok: boolean;
      resolved: boolean;
      finished?: boolean;
      winner?: 1 | 2 | 'draw';
      p1Score?: number;
      p2Score?: number;
      reward?: number;
      goal?: boolean;
    }
  >(functions, 'managePenaltyDuel');
  const res = await fn({ action: 'move', duelId, target, timeout });
  return res.data;
}

/** Estrae il messaggio utente da un errore di una callable. */
export function callableErrorMessage(e: unknown): string {
  const err = e as { message?: string; code?: string };
  return err.message ?? 'Errore di comunicazione col server';
}

// ============================================
// ADMIN API
// ============================================

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalSchedine: number;
  pendingMatchdays: number;
  activeSponsors: number;
}

export interface SponsorData {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  href: string | null;
  active: boolean;
}

export async function adminGetStatsFn(): Promise<AdminStats> {
  const fn = httpsCallable<Record<string, never>, AdminStats>(functions, 'adminGetStats');
  const res = await fn({});
  return res.data;
}

export async function adminSyncMatchdayFn(forceOdds = false): Promise<{ ok: boolean; matchday: { number: number; matches: number } | null }> {
  const fn = httpsCallable<{ forceOdds?: boolean }, { ok: boolean; matchday: { number: number; matches: number } | null }>(
    functions, 'adminSyncMatchday'
  );
  const res = await fn({ forceOdds });
  return res.data;
}

/**
 * `force` valuta la giornata anche con partite non ancora concluse: i relativi
 * pronostici risultano sbagliati e l'operazione non è reversibile, quindi il
 * server la rifiuta se non è chiesta esplicitamente.
 */
export async function adminForceSettleFn(
  matchdayNumber: number,
  force = false
): Promise<{ ok: boolean; settled: number; matchday: number }> {
  const fn = httpsCallable<
    { matchdayNumber: number; force?: boolean },
    { ok: boolean; settled: number; matchday: number }
  >(functions, 'adminForceSettle');
  const res = await fn({ matchdayNumber, force });
  return res.data;
}

/**
 * Azzeramento di inizio stagione: irreversibile, riporta tutti i profili allo
 * stato iniziale. Il server pretende la parola di conferma.
 */
export async function adminResetSeasonFn(): Promise<{ ok: boolean; profili: number }> {
  const fn = httpsCallable<{ confirm: string }, { ok: boolean; profili: number }>(
    functions,
    'adminResetSeason'
  );
  const res = await fn({ confirm: 'AZZERA' });
  return res.data;
}

export async function adminManageSponsorFn(
  action: 'list' | 'create' | 'update' | 'delete' | 'toggle',
  data: Partial<SponsorData> & { sponsorId?: string } = {}
): Promise<{ ok?: boolean; sponsors?: SponsorData[]; sponsorId?: string; active?: boolean }> {
  const fn = httpsCallable<
    { action: string } & Record<string, unknown>,
    { ok?: boolean; sponsors?: SponsorData[]; sponsorId?: string; active?: boolean }
  >(functions, 'adminManageSponsor');
  const res = await fn({ action, ...data });
  return res.data;
}

export async function adminToggleBanFn(targetUid: string): Promise<{ ok: boolean; isActive: boolean }> {
  const fn = httpsCallable<{ targetUid: string }, { ok: boolean; isActive: boolean }>(
    functions, 'adminToggleBan'
  );
  const res = await fn({ targetUid });
  return res.data;
}

export interface CompetitionStatus {
  code: string;
  name: string;
  slug: string;
  active: boolean;
}

export async function adminManageCompetitionsFn(
  action: 'list' | 'toggle',
  data: { code?: string } = {}
): Promise<{ competitions?: CompetitionStatus[]; ok?: boolean; active?: boolean }> {
  const fn = httpsCallable<
    { action: string } & Record<string, unknown>,
    { competitions?: CompetitionStatus[]; ok?: boolean; active?: boolean }
  >(functions, 'adminManageCompetitions');
  const res = await fn({ action, ...data });
  return res.data;
}

// --- DIRITTI DELL'INTERESSATO (GDPR) ---

export interface MyDataExport {
  exportedAt: string;
  format: string;
  profile: Record<string, unknown> | null;
  schedine: Record<string, unknown>[];
  walletTransactions: Record<string, unknown>[];
  penaltyDuels: Record<string, unknown>[];
  leagues: { id: string; name: string; isOwner: boolean }[];
}

/** Art. 20 GDPR — portabilità: scarica tutti i dati dell'utente corrente. */
export async function exportMyDataFn(): Promise<MyDataExport> {
  const fn = httpsCallable<Record<string, never>, MyDataExport>(functions, 'exportMyData');
  const res = await fn({} as Record<string, never>);
  return res.data;
}

export interface DeleteAccountResult {
  ok: boolean;
  removed: {
    schedine: number;
    walletTransactions: number;
    penaltyDuels: number;
    ownedLeagues: number;
  };
}

/**
 * Art. 17 GDPR — cancellazione. La parola di conferma è richiesta anche dal
 * server: impedisce che una chiamata accidentale distrugga l'account.
 */
export async function deleteAccountFn(confirm: string): Promise<DeleteAccountResult> {
  const fn = httpsCallable<{ confirm: string }, DeleteAccountResult>(functions, 'deleteAccount');
  const res = await fn({ confirm });
  return res.data;
}
