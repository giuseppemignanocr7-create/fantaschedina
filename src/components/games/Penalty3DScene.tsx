// ============================================
// FANTA SCHEDINA - PENALTY 3D SCENE
// Scena rigore in pseudo-3D (CSS puro, nessuna dipendenza): porta con
// prospettiva, portiere e pallone disegnati con gradienti/ombre per dare
// volume, tuffo/tiro animati con perspective+translateZ. Sostituisce la
// precedente sequenza di foto reali (che in crossfade creava un fastidioso
// effetto "doppia esposizione" con due scatti diversi sovrapposti).
// ============================================

import { cn } from '@/lib/utils';
import type { PenaltyTarget } from '@/lib/gameApi';

const ZONE_X: Record<PenaltyTarget, number> = { left: 18, center: 50, right: 82 };
const ZONE_TILT: Record<PenaltyTarget, number> = { left: -22, center: 0, right: 22 };

export interface Penalty3DShot {
  shot: PenaltyTarget;
  keeper: PenaltyTarget;
  goal: boolean;
}

interface Penalty3DSceneProps {
  /** Esito da animare. null = portiere in attesa. */
  revealShot: Penalty3DShot | null;
  /** Cambia ad ogni tiro per far ripartire l'animazione anche con lo stesso esito. */
  revealKey: string | number;
  /** Overlay di mira mostrato quando non si sta rivelando l'esito. */
  children?: React.ReactNode;
}

export function Penalty3DScene({ revealShot, revealKey, children }: Penalty3DSceneProps) {
  const shotX = revealShot ? ZONE_X[revealShot.shot] : 50;
  const keeperX = revealShot ? ZONE_X[revealShot.keeper] : 50;
  const keeperTilt = revealShot ? ZONE_TILT[revealShot.keeper] : 0;

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[320px] h-[220px] rounded-xl overflow-hidden select-none',
        revealShot && !revealShot.goal && 'animate-shake'
      )}
      style={{
        perspective: '600px',
        background: 'linear-gradient(180deg, #0a1530 0%, #10254d 42%, #145a2e 42%, #0d3d1f 100%)',
      }}
    >
      {/* Prato con prospettiva */}
      <div
        className="absolute left-0 right-0 bottom-0 h-[130px] opacity-90"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 24px, transparent 24px 48px)',
          transform: 'rotateX(55deg)',
          transformOrigin: 'bottom',
        }}
      />
      {/* Folla */}
      <div
        className="absolute top-0 left-0 right-0 h-[30px] opacity-40"
        style={{ background: 'repeating-radial-gradient(circle at 8px 8px, rgba(255,255,255,0.25) 0 1.5px, transparent 2px 12px)' }}
      />

      {/* Porta con prospettiva */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[26px] w-[250px] h-[92px]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Rete */}
        <div
          className="absolute inset-0 border-[3px] border-white/85 border-b-0 rounded-t-sm overflow-hidden"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 9px)',
            boxShadow: 'inset 0 -14px 18px -6px rgba(0,0,0,0.5)',
          }}
        />
        {/* Ombreggiatura pali per volume cilindrico */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(255,255,255,0.6))' }} />
        <div className="absolute right-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.6), rgba(0,0,0,0.35))' }} />

        {/* Portiere */}
        <div
          key={revealShot ? `k-${revealKey}` : 'k-idle'}
          className={cn('absolute bottom-0 z-10', revealShot ? 'animate-keeper3d-dive' : 'animate-keeper3d-idle')}
          style={{
            left: `${keeperX}%`,
            transform: 'translateX(-50%)',
            ['--dive-x' as string]: `${keeperX - 50}px`,
            ['--dive-tilt' as string]: `${keeperTilt}deg`,
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="relative w-9 h-[52px]" style={{ transformStyle: 'preserve-3d' }}>
            {/* Testa */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0 w-4 h-4 rounded-full"
              style={{ background: 'radial-gradient(circle at 35% 30%, #f2c9a0, #b8845a 70%)' }}
            />
            {/* Busto */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-[15px] w-6 h-6 rounded-lg"
              style={{ background: 'radial-gradient(circle at 30% 20%, #2a3550, #12172b 75%)', boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}
            />
            {/* Braccia (si aprono nel tuffo) */}
            <div className="absolute left-1/2 top-[17px] w-5 h-1.5 rounded-full origin-left"
              style={{ background: 'linear-gradient(90deg,#2a3550,#12172b)', transform: 'translateX(-2px) rotate(-18deg)' }} />
            <div className="absolute left-1/2 top-[17px] w-5 h-1.5 rounded-full origin-right"
              style={{ background: 'linear-gradient(90deg,#12172b,#2a3550)', transform: 'translateX(-18px) rotate(18deg)' }} />
            {/* Gambe */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-2 h-6 rounded-full ml-[-4px]" style={{ background: 'linear-gradient(90deg,#0d1220,#1c2340)' }} />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-2 h-6 rounded-full ml-[4px]" style={{ background: 'linear-gradient(90deg,#1c2340,#0d1220)' }} />
          </div>
        </div>

        {/* Mirini di scelta / overlay */}
        {children}
      </div>

      {/* Pallone */}
      <div
        key={revealShot ? `b-${revealKey}` : 'b-idle'}
        className={cn('absolute z-20', revealShot ? 'animate-ball3d-fly' : 'animate-ball3d-idle')}
        style={{
          left: '50%',
          bottom: '14px',
          width: '22px',
          height: '22px',
          marginLeft: '-11px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 28%, #ffffff, #d8dce3 60%, #9aa0ab 100%)',
          boxShadow: '0 2px 3px rgba(0,0,0,0.5)',
          ['--fly-x' as string]: `${shotX - 50}px`,
        }}
      />

      {/* Ombra pallone a terra */}
      <div
        key={revealShot ? `s-${revealKey}` : 's-idle'}
        className={cn('absolute z-[9] w-5 h-2 rounded-full bg-black/40 blur-[1px]', revealShot && 'animate-shadow3d-fly')}
        style={{ left: '50%', bottom: '10px', marginLeft: '-10px', ['--fly-x' as string]: `${shotX - 50}px` }}
      />

      {/* Flash esito */}
      {revealShot && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <p
            className={cn('font-display font-black text-3xl uppercase drop-shadow-lg animate-pop-in',
              revealShot.goal ? 'text-primary-300' : 'text-red-400')}
            style={{ animationDelay: '600ms' }}
          >
            {revealShot.goal ? 'GOOOL! ⚽' : 'PARATO! 🧤'}
          </p>
        </div>
      )}
    </div>
  );
}
