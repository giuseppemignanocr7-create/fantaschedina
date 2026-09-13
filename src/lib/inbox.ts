// ============================================
// CASELLA NOTIFICHE — lato client
//
// Ogni avviso che il server manda come push viene anche salvato in
// notifications/{uid}/items: cosi' la campanella mostra tutto, anche a chi
// non ha attivato le push o ha gia' scartato la notifica dal telefono.
// L'utente puo' segnare come letto e cancellare; scrive solo il server.
// ============================================

import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Notifica {
  id: string;
  title: string;
  body: string;
  path: string;
  read: boolean;
  createdAt: Date | null;
}

const items = (uid: string) => collection(db, 'notifications', uid, 'items');

/** Ascolta le ultime notifiche dell'utente, dalla piu' recente. */
export function ascoltaCasella(uid: string, cb: (n: Notifica[]) => void): () => void {
  const q = query(items(uid), orderBy('createdAt', 'desc'), limit(40));
  return onSnapshot(
    q,
    snap =>
      cb(
        snap.docs.map(d => {
          const x = d.data() as {
            title?: string;
            body?: string;
            path?: string;
            read?: boolean;
            createdAt?: Timestamp | null;
          };
          return {
            id: d.id,
            title: x.title ?? 'Fantaschedina',
            body: x.body ?? '',
            path: x.path ?? '/',
            read: x.read === true,
            createdAt: x.createdAt?.toDate?.() ?? null,
          };
        })
      ),
    err => console.warn('[inbox]', err)
  );
}

export async function segnaLetta(uid: string, id: string): Promise<void> {
  await updateDoc(doc(items(uid), id), { read: true, readAt: serverTimestamp() });
}

export async function segnaTutteLette(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) batch.update(doc(items(uid), id), { read: true, readAt: serverTimestamp() });
  await batch.commit();
}

export async function eliminaNotifica(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(items(uid), id));
}

export async function svuotaCasella(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) batch.delete(doc(items(uid), id));
  await batch.commit();
}
