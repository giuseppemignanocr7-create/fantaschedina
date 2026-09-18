// ============================================
// FANTA SCHEDINA - SERIE GIORNALIERA (badge)
// Mostra a che punto e' la serie e cosa vale tornare domani. Il conteggio lo
// tiene il server: qui si legge il profilo e si sceglie il tono.
// ============================================

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { statoSerie } from '@/lib/serie';

interface Props {
  streakDate: string | undefined;
  streakDays: number | undefined;
  className?: string;
}

/** Riga completa, per la testata della sala giochi. */
export function SerieCard({ streakDate, streakDays, className }: Props) {
  const s = statoSerie(streakDate, streakDays);

  const titolo = s.giocatoOggi
    ? `${s.giorni} giorn${s.giorni === 1 ? 'o' : 'i'} di fila`
    : s.aRischio
      ? `Serie di ${s.giorni} in bilico`
      : 'Nessuna serie attiva';

  const sotto = s.giocatoOggi
    ? `Torna domani per ${s.prossimoBonus} 🪙`
    : s.aRischio
      ? `Gioca oggi: ${s.prossimoBonus} 🪙 e la serie continua`
      : `Gioca oggi e inizia: ${s.prossimoBonus} 🪙`;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-2.5 border',
        s.giocatoOggi
          ? 'bg-orange-500/10 border-orange-500/30'
          : s.aRischio
            ? 'bg-yellow-500/10 border-yellow-500/40'
            : 'bg-slate-100 border-slate-200',
        className
      )}
    >
      <span className="relative flex-shrink-0">
        <Flame
          size={22}
          className={cn(
            s.giocatoOggi ? 'text-orange-600' : s.aRischio ? 'text-yellow-600' : 'text-slate-400'
          )}
        />
        {s.giorni > 0 && (
          <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-orange-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
            {s.giorni}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-slate-900 leading-tight">{titolo}</p>
        <p className="text-[11px] text-slate-500 leading-tight">{sotto}</p>
      </div>
    </div>
  );
}

/** Versione compatta, per le testate scure dei minigiochi. */
export function SerieBadge({ streakDate, streakDays, className }: Props) {
  const s = statoSerie(streakDate, streakDays);
  if (s.giorni === 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
        s.giocatoOggi ? 'bg-orange-500/20 text-orange-300' : 'bg-yellow-500/20 text-yellow-300',
        className
      )}
      title={s.giocatoOggi ? 'Serie al sicuro per oggi' : 'Gioca oggi per non perderla'}
    >
      <Flame size={11} /> {s.giorni}
    </span>
  );
}

/**
 * Riga da mostrare dopo una partita, quando il server ha accreditato il bonus.
 * `bonus` a 0 significa che oggi era gia' stato contato: non si dice nulla.
 */
export function SerieVinta({ giorni, bonus }: { giorni: number; bonus: number }) {
  if (!bonus || bonus <= 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/30 px-3 py-2">
      <Flame size={16} className="text-orange-600 flex-shrink-0" />
      <p className="text-xs font-bold text-orange-800">
        {giorni} giorn{giorni === 1 ? 'o' : 'i'} di fila: +{bonus} 🪙 di serie
      </p>
    </div>
  );
}
