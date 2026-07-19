// ============================================
// FANTA SCHEDINA - PENALTY STADIUM (scena condivisa)
// Scena rigore (porta, tifosi, portiere, palla) usata da
// RigoriPage e Sfide1v1Page. Riceve solo l'esito da animare.
// ============================================

import { cn } from '@/lib/utils';
import { BALL_FLY, KEEPER_DIVE, type PenaltyZone } from '@/lib/penalty';

export interface PenaltyStadiumShot {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  goal: boolean;
}

interface PenaltyStadiumProps {
  /** Esito da animare (dive portiere + volo palla). null = portiere in attesa. */
  revealShot: PenaltyStadiumShot | null;
  /** Cambia ad ogni tiro per far ripartire l'animazione anche con stesso esito. */
  revealKey: number | string;
  /** Overlay sulla porta (es. griglia di mira) mostrato quando non si sta rivelando l'esito. */
  children?: React.ReactNode;
}

export function PenaltyStadium({ revealShot, revealKey, children }: PenaltyStadiumProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[300px] h-[190px] rounded-xl overflow-hidden select-none',
      revealShot && !revealShot.goal && 'animate-shake')}
      style={{ background: 'linear-gradient(180deg, #0a1530 0%, #10254d 55%, #14532d 55%, #166534 100%)' }}
    >
      {/* Crowd dots */}
      <div className="absolute top-0 left-0 right-0 h-[38px] opacity-40"
        style={{ background: 'repeating-radial-gradient(circle at 8px 8px, rgba(255,255,255,0.25) 0 1.5px, transparent 2px 12px)' }} />

      {/* Goal frame */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[36px] w-[240px] h-[86px] border-[3px] border-white/80 border-b-0 rounded-t-sm"
        style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 10px)' }}>
        {/* Keeper */}
        <div
          key={revealShot ? `k-${revealKey}` : 'k-idle'}
          className={cn('absolute left-1/2 bottom-0 -ml-[18px] text-4xl select-none z-10',
            revealShot ? 'animate-keeper-dive' : 'animate-wiggle')}
          style={revealShot ? {
            ['--dive-x' as string]: KEEPER_DIVE[revealShot.keeper]?.x ?? '0px',
            ['--dive-y' as string]: KEEPER_DIVE[revealShot.keeper]?.y ?? '0px',
            ['--dive-r' as string]: KEEPER_DIVE[revealShot.keeper]?.r ?? '0deg',
          } : undefined}
        >
          🧤
        </div>

        {/* Zone overlay (griglia di mira o vuoto) */}
        {children}
      </div>

      {/* Ball */}
      <div
        key={revealShot ? `b-${revealKey}` : 'b-idle'}
        className={cn('absolute left-1/2 -ml-[15px] bottom-[10px] text-3xl select-none',
          revealShot && 'animate-ball-fly')}
        style={revealShot ? {
          ['--fly-x' as string]: BALL_FLY[revealShot.shot]?.x ?? '0px',
          ['--fly-y' as string]: BALL_FLY[revealShot.shot]?.y ?? '-70px',
        } : undefined}
      >
        ⚽
      </div>

      {/* Penalty spot */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[8px] w-8 h-1.5 rounded-full bg-black/30" />

      {/* Reveal flash */}
      {revealShot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p
            className={cn('font-display font-black text-3xl uppercase drop-shadow-lg animate-pop-in',
              revealShot.goal ? 'text-primary-300' : 'text-red-400')}
            style={{ animationDelay: '450ms', opacity: 0, animationFillMode: 'forwards' }}
          >
            {revealShot.goal ? 'GOOOOL! ⚽' : 'PARATO! 🧤'}
          </p>
        </div>
      )}
    </div>
  );
}
