// ============================================
// FANTA SCHEDINA - BARRA DI POTENZA
// Timing del tiro: il cursore corre avanti e indietro, si ferma con un tocco.
// Piu' e' a destra (nel verde), piu' il tiro e' preciso e potente: il valore
// (0-100) va al server, che lo vincola e lo usa per calcolare l'esito.
// Renderizzata FUORI dall'arena (che ha overflow-hidden).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ZONE_META, ZONE_RISK, type PenaltyZone } from '@/lib/penalty';

/** Un'andata del cursore. Andata + ritorno = 1,4 s: si fa in tempo, ma non a occhi chiusi. */
const POWER_PERIOD_MS = 700;

interface PenaltyPowerMeterProps {
  zone: PenaltyZone;
  onConfirm: (power: number) => void;
  onCancel?: () => void;
  /** Etichetta del pulsante (default "TIRA!"). */
  cta?: string;
  /** Sfondo scuro (dentro l'arena del duello) o chiaro (card). */
  tone?: 'dark' | 'light';
}

export function PenaltyPowerMeter({ zone, onConfirm, onCancel, cta = 'TIRA!', tone = 'light' }: PenaltyPowerMeterProps) {
  const [barPos, setBarPos] = useState(0);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const cycle = elapsed % (POWER_PERIOD_MS * 2);
      const pos =
        cycle <= POWER_PERIOD_MS
          ? (cycle / POWER_PERIOD_MS) * 100
          : 100 - ((cycle - POWER_PERIOD_MS) / POWER_PERIOD_MS) * 100;
      posRef.current = pos;
      setBarPos(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const conferma = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onConfirm(Math.round(posRef.current));
  };

  const risk = ZONE_RISK[zone];
  const dark = tone === 'dark';

  return (
    <div className={cn('space-y-2.5 animate-pop-in', dark ? 'text-white' : 'text-slate-900')}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-[11px] font-black uppercase tracking-wide', dark ? 'text-white/80' : 'text-slate-600')}>
          Mira: {ZONE_META[zone].label.toLowerCase()}
        </p>
        <span
          className={cn(
            'text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase',
            risk === 'alto' && 'bg-red-500/20 text-red-300',
            risk === 'medio' && 'bg-yellow-500/20 text-yellow-300',
            risk === 'basso' && (dark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'),
            !dark && risk === 'alto' && 'text-red-700',
            !dark && risk === 'medio' && 'text-yellow-800'
          )}
        >
          {risk === 'alto' ? 'Imparabile ma rischioso' : risk === 'medio' ? 'Angolo sicuro' : 'Facile da parare'}
        </span>
      </div>

      {/* Barra: tocco ovunque per fermare il cursore */}
      <button
        type="button"
        onClick={conferma}
        aria-label="Ferma il cursore e tira"
        className={cn(
          'relative block w-full h-9 rounded-full overflow-hidden border-2 active:scale-[0.99] transition-transform',
          dark ? 'border-white/20 bg-black/40' : 'border-slate-300 bg-slate-100'
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-400 to-primary-500 opacity-80" />
        {/* tacche */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_9%,rgba(0,0,0,0.18)_9%_10%)]" />
        {/* zona perfetta */}
        <div className="absolute top-0 bottom-0 right-0 w-[12%] bg-primary-300/40 border-l-2 border-white/70" />
        <div
          className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_3px_rgba(255,255,255,0.75)]"
          style={{ left: `calc(${barPos}% - 4px)` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-black/60 mix-blend-multiply">
          potenza
        </span>
      </button>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'px-3 py-2.5 rounded-xl text-xs font-bold transition-colors',
              dark ? 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
            )}
          >
            ← Cambia mira
          </button>
        )}
        <button
          type="button"
          onClick={conferma}
          className="flex-1 py-2.5 rounded-xl bg-primary-500 text-night font-black text-sm uppercase tracking-wide active:scale-95 transition-transform shadow-lg shadow-primary-500/30"
        >
          ⚡ {cta}
        </button>
      </div>
    </div>
  );
}
