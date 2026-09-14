import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/db';
import { CATEGORIE_NOTIFICA, categoriaAttiva, type CategoriaNotifica, type PrefNotifiche } from '@/lib/notifiche';
import { cn } from '@/lib/utils';

/**
 * Scelta delle categorie. Una categoria spenta non arriva né come push né
 * in casella: chi non vuole un avviso non deve ritrovarselo comunque nella
 * campanella.
 */
export function NotifPrefs() {
  const { user, profile, refreshProfile } = useAuthContext();
  const [prefs, setPrefs] = useState<PrefNotifiche>(() => (profile?.notifPrefs ?? {}) as PrefNotifiche);
  const [inCorso, setInCorso] = useState<CategoriaNotifica | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  if (!user) return null;

  const cambia = async (cat: CategoriaNotifica) => {
    const nuove: PrefNotifiche = { ...prefs, [cat]: !categoriaAttiva(prefs, cat) };
    setPrefs(nuove);
    setInCorso(cat);
    setErrore(null);
    try {
      await updateProfile(user.uid, { notifPrefs: nuove } as never);
      void refreshProfile();
    } catch {
      setPrefs(prefs);
      setErrore('Non sono riuscito a salvare la scelta, riprova.');
    } finally {
      setInCorso(null);
    }
  };

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cosa vuoi ricevere</p>
      {CATEGORIE_NOTIFICA.map(c => {
        const attiva = categoriaAttiva(prefs, c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => void cambia(c.id)}
            disabled={inCorso !== null}
            role="switch"
            aria-checked={attiva}
            className="w-full flex items-center gap-3 py-2 text-left disabled:opacity-60"
          >
            <span className="text-base w-6 text-center flex-shrink-0">{c.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-slate-900 leading-tight">{c.nome}</span>
              <span className="block text-[10px] text-slate-500 leading-snug">{c.dettaglio}</span>
            </span>
            {inCorso === c.id ? (
              <Loader2 size={16} className="text-slate-400 animate-spin flex-shrink-0" />
            ) : (
              <span
                className={cn(
                  'w-9 h-5 rounded-full flex-shrink-0 relative transition-colors',
                  attiva ? 'bg-primary-500' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                    attiva ? 'left-[18px]' : 'left-0.5'
                  )}
                />
              </span>
            )}
          </button>
        );
      })}
      <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
        Fra le 23 e le 8 non arrivano avvisi sul telefono: li trovi nella campanella al risveglio.
      </p>
      {errore && <p className="text-xs text-red-600 font-medium">{errore}</p>}
    </div>
  );
}
