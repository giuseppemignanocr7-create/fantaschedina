import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Ricarica il profilo dopo un'azione che ne cambia lo stato (minigiochi,
 * missioni) senza bloccare la UI sull'esito già mostrato: un fallimento qui
 * va solo loggato per poterlo diagnosticare, non impedire il risultato che
 * il server ha già confermato.
 */
export function useSilentProfileRefresh(tag: string): () => void {
  const { refreshProfile } = useAuthContext();
  return useCallback(() => {
    void refreshProfile().catch(err => console.error(`[${tag}] refreshProfile:`, err));
  }, [refreshProfile, tag]);
}
