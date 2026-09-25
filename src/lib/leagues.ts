// ============================================
// FANTA SCHEDINA - LEGHE PRIVATE (Firestore)
// Crea/entra con codice invito, classifica di lega dai punti reali.
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getRankingsFn, manageLeagueFn, type RankingRow } from './gameApi';

export interface LeagueDoc {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  inviteCode: string;
  isPrivate: boolean;
  maxMembers: number;
  memberIds: string[];
  memberCount: number;
  /** Agenzia scritta da chi ha creato la lega, in attesa che l'admin la assegni. */
  agenziaRichiesta?: string | null;
  /** Agenzia assegnata dall'admin: decide il palinsesto delle quote della lega. */
  bookmaker?: string | null;
  /** `in_attesa` finche' l'admin non assegna l'agenzia richiesta. */
  stato?: 'in_attesa' | 'attiva';
  createdAt: Timestamp | null;
}

export interface LeagueStanding {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
}

export async function createLeague(
  ownerId: string,
  ownerName: string,
  name: string,
  description: string,
  isPrivate: boolean,
  maxMembers: number,
  /** Agenzia per il palinsesto delle quote: vuota = quote standard. */
  agenziaRichiesta = ''
): Promise<void> {
  void ownerId;
  void ownerName;
  await manageLeagueFn('create', {
    name,
    description,
    isPrivate,
    maxMembers,
    agenziaRichiesta,
  });
}

export async function getUserLeagues(uid: string): Promise<LeagueDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'leagues'), where('memberIds', 'array-contains', uid))
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LeagueDoc, 'id'>) }));
}

/**
 * Una singola lega, per la sua pagina dedicata. Le regole Firestore la
 * lasciano leggere solo a chi ne è membro (o se è pubblica): fuori da quei
 * casi il documento risulta assente, ed è il comportamento voluto.
 */
export async function getLeague(leagueId: string): Promise<LeagueDoc | null> {
  const snap = await getDoc(doc(db, 'leagues', leagueId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<LeagueDoc, 'id'>) } : null;
}

export async function getPublicLeagues(): Promise<LeagueDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'leagues'), where('isPrivate', '==', false))
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LeagueDoc, 'id'>) }));
}

export async function joinLeagueByCode(
  uid: string,
  inviteCode: string
): Promise<void> {
  void uid;
  await manageLeagueFn('joinByCode', { inviteCode });
}

/**
 * Chi crea una lega vede le schedine dei membri appena inviate (callable
 * getSchedineLega, funzione voluta): chi entra deve saperlo prima.
 */
export const AVVISO_GIOCATE_VISIBILI = 'Il creatore della lega vedrà le tue giocate appena le invii.';

/** Cio' che chi apre un link d'invito vede prima di decidere se entrare. */
export interface AnteprimaInvito {
  leagueId: string;
  name: string;
  ownerName: string;
  memberCount: number;
  maxMembers: number;
  giaMembro: boolean;
}

/**
 * Dati essenziali della lega di un codice invito. Le regole non lasciano
 * leggere una lega privata a chi non ne fa parte: li fornisce il server.
 */
export async function anteprimaInvito(inviteCode: string): Promise<AnteprimaInvito> {
  return manageLeagueFn<AnteprimaInvito>('anteprimaInvito', { inviteCode });
}

export async function joinLeague(uid: string, leagueId: string): Promise<void> {
  void uid;
  await manageLeagueFn('joinPublic', { leagueId });
}

export async function leaveLeague(uid: string, leagueId: string): Promise<void> {
  void uid;
  await manageLeagueFn('leave', { leagueId });
}

export async function deleteLeague(leagueId: string): Promise<void> {
  await manageLeagueFn('delete', { leagueId });
}

/**
 * Classifica di lega dai punti reali dei membri.
 *
 * Il calcolo è del server (callable `getRankings` con `leagueId`): prima
 * questa funzione scaricava l'intero elenco dei profili del gioco per poi
 * tenerne i pochi della lega.
 */
export async function getLeagueStandings(league: LeagueDoc): Promise<LeagueStanding[]> {
  const { rankings } = await getRankingsFn(league.id);
  return rankings.map((r: RankingRow) => ({
    rank: r.rank,
    userId: r.participantId,
    username: r.username,
    totalPoints: r.totalPoints,
  }));
}
