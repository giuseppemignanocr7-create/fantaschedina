// ============================================
// ESTRAZIONE DI GIORNATA — lato client
//
// raffles/{giornata}: stato pubblico (premio, biglietti totali, vincitore).
// raffle_tickets/{giornata}_{uid}: i biglietti dell'utente.
// L'acquisto passa dalla callable buyRaffleTicket, che scala i gettoni in
// transazione; il sorteggio lo fa il server a giornata valutata.
// ============================================

import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';

export interface RaffleDoc {
  matchday: number;
  prize: { label: string; emoji?: string };
  totalTickets: number;
  participants: number;
  status: 'open' | 'drawn';
  winnerUid?: string;
  winnerUsername?: string;
}

export async function leggiEstrazione(giornata: number): Promise<RaffleDoc | null> {
  const snap = await getDoc(doc(db, 'raffles', String(giornata)));
  return snap.exists() ? (snap.data() as RaffleDoc) : null;
}

export async function leggiMieiBiglietti(giornata: number, uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'raffle_tickets', `${giornata}_${uid}`));
  return snap.exists() ? ((snap.data().count as number) ?? 0) : 0;
}

/** L'ultima estrazione gia' fatta, per mostrare chi ha vinto. */
export async function leggiUltimaEstrazione(): Promise<RaffleDoc | null> {
  const q = query(collection(db, 'raffles'), where('status', '==', 'drawn'), orderBy('matchday', 'desc'), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as RaffleDoc);
}

export async function compraBiglietti(
  count: number
): Promise<{ ok: true; count: number; totalTickets: number; coins: number } | { ok: false; motivo: string }> {
  try {
    const fn = httpsCallable<{ count: number }, { count: number; totalTickets: number; coins: number }>(
      functions,
      'buyRaffleTicket'
    );
    const res = await fn({ count });
    return { ok: true, ...res.data };
  } catch (e) {
    return { ok: false, motivo: (e as { message?: string }).message ?? 'Acquisto non riuscito' };
  }
}
