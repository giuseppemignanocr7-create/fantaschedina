import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  ascoltaCasella,
  eliminaNotifica,
  segnaLetta,
  segnaTutteLette,
  svuotaCasella,
  type Notifica,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

function quando(d: Date | null): string {
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'adesso';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min fa`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

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

interface Props {
  aperto: boolean;
  onClose: () => void;
  notifiche: Notifica[];
}

/** Pannello sotto l'header: le notifiche ricevute, da leggere o cancellare. */
export function NotificationsPanel({ aperto, onClose, notifiche }: Props) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  if (!aperto || !user) return null;
  const uid = user.uid;
  const nonLette = notifiche.filter(n => !n.read);

  const apri = async (n: Notifica) => {
    if (!n.read) void segnaLetta(uid, n.id);
    onClose();
    navigate(n.path || '/');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={onClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-label="Notifiche"
        className="fixed top-14 left-0 right-0 md:left-auto md:right-3 md:w-96 z-50 max-h-[70vh] flex flex-col bg-white border-b md:border md:rounded-2xl border-slate-200 shadow-2xl animate-slide-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary-700" />
            <p className="font-black text-sm text-slate-900">Notifiche</p>
            {nonLette.length > 0 && (
              <span className="text-[10px] font-bold bg-primary-500 text-night rounded-full px-1.5 py-0.5">
                {nonLette.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {nonLette.length > 0 && (
              <button
                type="button"
                onClick={() => void segnaTutteLette(uid, nonLette.map(n => n.id))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Segna tutte come lette"
                title="Segna tutte come lette"
              >
                <CheckCheck size={16} />
              </button>
            )}
            {notifiche.length > 0 && (
              <button
                type="button"
                onClick={() => void svuotaCasella(uid, notifiche.map(n => n.id))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100"
                aria-label="Cancella tutte"
                title="Cancella tutte"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Chiudi"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <ul className="overflow-y-auto divide-y divide-slate-100">
          {notifiche.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Nessuna notifica. Qui arrivano gli avvisi su scadenze, partite e giornate valutate.
            </li>
          )}
          {notifiche.map(n => (
            <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.read && 'bg-primary-500/5')}>
              <button type="button" onClick={() => void apri(n)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                  <p className={cn('text-sm leading-tight text-slate-900', !n.read ? 'font-black' : 'font-semibold')}>
                    {n.title}
                  </p>
                </div>
                {n.body && <p className="text-xs text-slate-600 mt-0.5 leading-snug">{n.body}</p>}
                <p className="text-[10px] text-slate-400 mt-1">{quando(n.createdAt)}</p>
              </button>
              <button
                type="button"
                onClick={() => void eliminaNotifica(uid, n.id)}
                className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 flex-shrink-0"
                aria-label="Cancella notifica"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
