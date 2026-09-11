// ============================================
// NOTIFICHE PUSH — lato client
//
// Tre momenti riportano un giocatore nell'app: la schedina che sta per
// chiudere, il calcio d'inizio, la giornata valutata. Li manda il server
// (Cloud Functions) ai token registrati qui. `firebase/messaging` pesa
// ~30 kB: si carica solo quando l'utente attiva le notifiche.
// ============================================

import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, firebaseApp, functions } from '@/lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export type PushStatus = 'unsupported' | 'blocked' | 'off' | 'on';

const chiave = (uid: string) => `push:${uid}`;

/** Vero se browser e configurazione permettono le notifiche. */
export function pushSupportata(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_KEY
  );
}

/** Stato attuale per l'utente loggato. */
export function statoPush(uid: string | null | undefined): PushStatus {
  if (!pushSupportata()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (!uid) return 'off';
  try {
    return localStorage.getItem(chiave(uid)) && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

async function registrazioneSW(): Promise<ServiceWorkerRegistration> {
  // In produzione il SW della PWA (che include push-sw.js) e' gia' registrato
  // a scope "/". In sviluppo non c'e': si registra il solo push-sw.js.
  const esistente = await navigator.serviceWorker.getRegistration('/');
  if (esistente) return esistente;
  return navigator.serviceWorker.register('/push-sw.js');
}

/**
 * Chiede il permesso e registra il token. Va chiamata da un click
 * dell'utente: i browser ignorano richieste di permesso non sollecitate.
 */
export async function attivaPush(): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, motivo: 'Devi essere loggato' };
  if (!pushSupportata()) return { ok: false, motivo: 'Notifiche non supportate su questo dispositivo' };

  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') {
    return {
      ok: false,
      motivo:
        permesso === 'denied'
          ? 'Notifiche bloccate: riattivale dalle impostazioni del browser'
          : 'Permesso non concesso',
    };
  }

  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return { ok: false, motivo: 'Notifiche non supportate su questo browser' };
    const reg = await registrazioneSW();
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, motivo: 'Impossibile ottenere il token' };
    await setDoc(doc(db, 'push_tokens', token), {
      uid: user.uid,
      createdAt: serverTimestamp(),
      ua: navigator.userAgent.slice(0, 120),
    });
    localStorage.setItem(chiave(user.uid), token);
    ascoltaInPrimoPiano(reg);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: (e as Error).message ?? 'Errore di attivazione' };
  }
}

/** Cancella il token: il server smette di inviare a questo dispositivo. */
export async function disattivaPush(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const token = localStorage.getItem(chiave(user.uid));
  localStorage.removeItem(chiave(user.uid));
  if (!token) return;
  try {
    await deleteDoc(doc(db, 'push_tokens', token));
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(firebaseApp));
  } catch (e) {
    console.warn('[push] disattivazione:', e);
  }
}

/** Chiede al server una notifica di prova per i propri dispositivi. */
export async function inviaNotificaDiProva(): Promise<{ ok: true; consegnati: number } | { ok: false; motivo: string }> {
  try {
    const fn = httpsCallable<void, { dispositivi: number; consegnati: number }>(functions, 'sendTestPush');
    const res = await fn();
    return { ok: true, consegnati: res.data.consegnati };
  } catch (e) {
    const msg = (e as { message?: string }).message ?? 'Invio non riuscito';
    return { ok: false, motivo: msg };
  }
}

let inAscolto = false;

/**
 * Con l'app in primo piano il browser non mostra le push da solo: le
 * mostriamo noi con la stessa grafica del service worker.
 */
async function ascoltaInPrimoPiano(reg: ServiceWorkerRegistration): Promise<void> {
  if (inAscolto) return;
  inAscolto = true;
  const { getMessaging, onMessage } = await import('firebase/messaging');
  onMessage(getMessaging(firebaseApp), payload => {
    const n = payload.notification ?? {};
    const url = payload.fcmOptions?.link ?? payload.data?.url ?? '/';
    void reg.showNotification(n.title ?? 'Fantaschedina', {
      body: n.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url },
    });
  });
}

/** All'avvio, se l'utente aveva attivato le notifiche, riprende l'ascolto. */
export async function riprendiPush(uid: string): Promise<void> {
  if (statoPush(uid) !== 'on') return;
  try {
    const reg = await registrazioneSW();
    await ascoltaInPrimoPiano(reg);
  } catch (e) {
    console.warn('[push] ripresa:', e);
  }
}
