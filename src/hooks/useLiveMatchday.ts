// ============================================
// LIVE — punteggi che si muovono da soli.
//
// Il meccanismo esisteva gia' ma viveva dentro LivePage, e LivePage non e'
// nel menu: su MATCH e dentro le leghe i risultati restavano fermi a quando
// si era aperta la pagina. Qui sta in un hook, cosi' ogni pagina che mostra
// partite e' viva allo stesso modo.
//
// Due fonti che si sommano:
//  A) polling ESPN ogni 45 secondi (`refreshLiveScores` non fa nulla fuori
//     dalla finestra live, quindi chiamarlo sempre non costa niente);
//  B) il documento della giornata su Firestore, aggiornato dal server, in
//     tempo reale.
// ============================================

import { useEffect } from 'react';
import { useAppStore } from '@/store';

const INTERVALLO_POLLING_MS = 45_000;

export function useLiveMatchday(): void {
  const currentMatchday = useAppStore(s => s.currentMatchday);
  const refreshLiveScores = useAppStore(s => s.refreshLiveScores);
  const subscribeMatchday = useAppStore(s => s.subscribeMatchday);

  useEffect(() => {
    void refreshLiveScores();
    const id = setInterval(() => void refreshLiveScores(), INTERVALLO_POLLING_MS);
    return () => clearInterval(id);
  }, [refreshLiveScores]);

  const matchdayNumber = currentMatchday?.number;
  useEffect(() => {
    if (!matchdayNumber) return;
    const unsubscribe = subscribeMatchday(matchdayNumber);
    return () => unsubscribe();
  }, [matchdayNumber, subscribeMatchday]);
}
