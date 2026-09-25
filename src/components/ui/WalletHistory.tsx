import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { leggiMovimenti, type Movimento } from '@/lib/wallet';
import { cn } from '@/lib/utils';

function quando(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** Saldo, ultimi movimenti e dove spendere: la card "Gettoni" di Account. */
export function WalletCard() {
  const { user, profile } = useAuthContext();
  const [movimenti, setMovimenti] = useState<Movimento[] | null>(null);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    leggiMovimenti(user.uid, 30)
      .then(m => {
        if (vivo) setMovimenti(m);
      })
      .catch(() => {
        if (vivo) setMovimenti([]);
      });
    return () => {
      vivo = false;
    };
  }, [user]);

  const visibili = aperto ? movimenti ?? [] : (movimenti ?? []).slice(0, 5);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-yellow-700" />
          <p className="font-black text-sm text-slate-900">Gettoni</p>
        </div>
        <p className="text-lg font-black text-yellow-700">{profile?.coins ?? 0} 🪙</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Link to="/pronostici" className="rounded-xl bg-slate-100 hover:bg-slate-200 p-2 transition-colors">
          <p className="text-base">🃏</p>
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Power-up</p>
          <p className="text-[10px] text-slate-500">sulla schedina</p>
        </Link>
        <Link to="/premi" className="rounded-xl bg-slate-100 hover:bg-slate-200 p-2 transition-colors">
          <p className="text-base">🎟️</p>
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Biglietti</p>
          <p className="text-[10px] text-slate-500">estrazione premi</p>
        </Link>
        <Link to="/minigiochi" className="rounded-xl bg-slate-100 hover:bg-slate-200 p-2 transition-colors">
          <p className="text-base">🎮</p>
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Guadagnali</p>
          <p className="text-[10px] text-slate-500">sala giochi</p>
        </Link>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Ultimi movimenti</p>
        {movimenti === null ? (
          <div className="flex justify-center py-3">
            <Loader2 size={16} className="text-slate-400 animate-spin" />
          </div>
        ) : movimenti.length === 0 ? (
          <p className="text-xs text-slate-500">Ancora nessun movimento: gioca la schedina o un minigioco.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visibili.map(m => (
              <li key={m.id} className="flex items-center justify-between py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{m.label}</p>
                  <p className="text-[10px] text-slate-500">{quando(m.createdAt)}</p>
                </div>
                <span
                  className={cn(
                    'font-black tabular-nums flex-shrink-0 ml-3',
                    m.amount >= 0 ? 'text-green-700' : 'text-red-600'
                  )}
                >
                  {m.amount >= 0 ? '+' : ''}
                  {m.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        {movimenti && movimenti.length > 5 && (
          <button
            type="button"
            onClick={() => setAperto(a => !a)}
            className="mt-2 text-[11px] font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5"
          >
            {aperto ? 'Mostra meno' : `Mostra tutti (${movimenti.length})`}
            <ChevronRight size={12} className={cn('transition-transform', aperto && 'rotate-90')} />
          </button>
        )}
      </div>
    </div>
  );
}
