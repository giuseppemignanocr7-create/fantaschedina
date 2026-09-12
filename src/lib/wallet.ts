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

/** Causale leggibile a partire dal `reason` scritto dal server. */
export function etichettaCausale(reason: string): string {
  const g = reason.match(/_g(\d+)$/)?.[1];
  const giornata = g ? ` giornata ${g}` : '';
  if (reason.startsWith('settlement')) return `Punti della${giornata}`;
  if (reason.startsWith('powerups_refund')) return `Rimborso power-up${giornata}`;
  if (reason.startsWith('powerup_lastminute')) return `Cambio last-minute${giornata}`;
  if (reason.startsWith('powerups')) return `Power-up${giornata}`;
  if (reason.startsWith('raffle')) return `Biglietti estrazione${giornata}`;
  if (reason.startsWith('mission')) return 'Missione completata';
  if (reason.includes('quiz')) return 'Quiz calcio';
  if (reason.includes('ruota') || reason.includes('wheel')) return 'Ruota della fortuna';
  if (reason.includes('rigori') || reason.includes('penalty_shoot')) return 'Rigori';
  if (reason.includes('memoria')) return 'Memoria calcio';
  if (reason.includes('sfida')) return 'Sfida 1vs1';
  if (reason.includes('duel')) return reason.includes('draw') ? 'Duello: pareggio' : 'Duello vinto';
  if (reason.includes('weekly') || reason.includes('winner')) return 'Vincitore di giornata';
  if (reason.includes('starting') || reason.includes('welcome')) return 'Bonus di benvenuto';
  return reason.replace(/_/g, ' ');
}

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
