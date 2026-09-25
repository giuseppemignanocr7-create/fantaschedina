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
import { manageLeagueFn } from './gameApi';

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
