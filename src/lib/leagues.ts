// ============================================
// FANTA SCHEDINA - LEGHE PRIVATE (Firestore)
// Crea/entra con codice invito, classifica di lega dai punti reali.
// ============================================

import {
  collection,
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
  maxMembers: number
): Promise<void> {
  void ownerId;
  void ownerName;
  await manageLeagueFn('create', { name, description, isPrivate, maxMembers });
}

export async function getUserLeagues(uid: string): Promise<LeagueDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'leagues'), where('memberIds', 'array-contains', uid))
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LeagueDoc, 'id'>) }));
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
