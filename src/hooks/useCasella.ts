import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { ascoltaCasella, type Notifica } from '@/lib/inbox';

/** Ascolta la casella dell'utente loggato: lista e conteggio non lette. */
export function useCasella(): { notifiche: Notifica[]; nonLette: number } {
  const { user } = useAuthContext();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  useEffect(() => {
    if (!user) return;
    return ascoltaCasella(user.uid, setNotifiche);
  }, [user]);
  // Senza utente la lista e' vuota per costruzione: niente setState nell'effetto.
  const lista = user ? notifiche : [];
  return { notifiche: lista, nonLette: lista.filter(n => !n.read).length };
}
