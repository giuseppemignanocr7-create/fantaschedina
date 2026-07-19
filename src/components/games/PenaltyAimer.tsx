// ============================================
// FANTA SCHEDINA - PENALTY AIMER (mira condivisa)
// PenaltyZoneGrid: overlay a 6 zone dentro la porta (dentro PenaltyStadium).
// PenaltyPowerMeter: barra di timing per la potenza/precisione del tiro,
// renderizzata FUORI dalla scena (che ha overflow-hidden).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ZONE_LAYOUT, ZONE_RISK, type PenaltyZone } from '@/lib/penalty';

interface PenaltyZoneGridProps {
  disabled?: boolean;
  onPick: (zone: PenaltyZone) => void;
}

export function PenaltyZoneGrid({ disabled, onPick }: PenaltyZoneGridProps) {
  return (
    <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
      {ZONE_LAYOUT.map(z => (
        <button
          key={z.zone}
          disabled={disabled}
          onClick={() => onPick(z.zone)}
          aria-label={`Mira ${z.label}`}
          title={z.label}
          className={cn(
            'group relative border border-white/10 transition-colors',
            !disabled && 'hover:bg-white/15 active:bg-white/25',
            disabled && 'cursor-not-allowed'
          )}
        >
          <span className={cn(
            'absolute top-1 right-1 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity',
            ZONE_RISK[z.zone] === 'alto' ? 'bg-red-400' : ZONE_RISK[z.zone] === 'medio' ? 'bg-yellow-400' : 'bg-white/50'
          )} />
        </button>
      ))}
    </div>
  );
}

const POWER_PERIOD_MS = 900;

interface PenaltyPowerMeterProps {
  zone: PenaltyZone;
  onConfirm: (power: number) => void;
  onCancel: () => void;
}

export function PenaltyPowerMeter({ zone, onConfirm, onCancel }: PenaltyPowerMeterProps) {
  const [barPos, setBarPos] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const cycle = elapsed % (POWER_PERIOD_MS * 2);
      const pos = cycle <= POWER_PERIOD_MS
        ? (cycle / POWER_PERIOD_MS) * 100
        : 100 - ((cycle - POWER_PERIOD_MS) / POWER_PERIOD_MS) * 100;
      setBarPos(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const risk = ZONE_RISK[zone];

  return (
    <div className="glass-card p-3 space-y-2 animate-pop-in">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/50 font-bold uppercase tracking-wide">
          Ferma la barra nel verde per la massima precisione!
        </p>
        <span className={cn(
          'text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase',
          risk === 'alto' ? 'bg-red-500/20 text-red-300' : risk === 'medio' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/40'
        )}>
          {risk === 'alto' ? 'Angolo rischioso' : risk === 'medio' ? 'Angolo medio' : 'Zona centrale'}
        </span>
      </div>
      <div className="relative h-4 rounded-full bg-white/10 overflow-hidden border border-white/15">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/70 via-yellow-400/70 to-green-500/80" />
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.6)]"
          style={{ left: `calc(${barPos}% - 3px)` }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/10 transition-colors"
        >
          ← Cambia mira
        </button>
        <button
          onClick={() => onConfirm(barPos)}
          className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-black text-sm uppercase tracking-wide active:scale-95 transition-transform shadow-lg shadow-primary-500/30"
        >
          TIRA! ⚡
        </button>
      </div>
    </div>
  );
}
