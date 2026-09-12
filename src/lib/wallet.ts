// ============================================
// PORTAFOGLIO — storico dei gettoni
//
// Il server scrive una riga in wallet_transactions per ogni accredito o
// addebito (settlement, minigiochi, power-up, missioni, biglietti). Qui si
// leggono le ultime e si traducono le causali in italiano leggibile.
// ============================================

import { collection, getDocs, limit, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Movimento {
  id: string;
  amount: number;
  reason: string;
  label: string;
  createdAt: Date | null;
}

import { etichettaCausale } from '@/lib/walletLabels';

export { etichettaCausale };

/** Ultimi movimenti dell'utente, dal piu' recente. */
export async function leggiMovimenti(uid: string, quanti = 30): Promise<Movimento[]> {
  const q = query(
    collection(db, 'wallet_transactions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(quanti)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const x = d.data() as { amount: number; reason: string; createdAt?: Timestamp | null };
    return {
      id: d.id,
      amount: x.amount,
      reason: x.reason,
      label: etichettaCausale(x.reason ?? ''),
      createdAt: x.createdAt?.toDate?.() ?? null,
    };
  });
}
