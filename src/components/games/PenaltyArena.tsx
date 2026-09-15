// ============================================
// FANTA SCHEDINA - PENALTY ARENA
// Scena del rigore con asset fotografici (15/09/2026): stadio notturno
// reale come sfondo e portiere in sette pose (in attesa, accovacciato, salto,
// quattro tuffi) forniti dall'utente, ritagliati e compressi in WebP in
// src/assets/arena. Il pallone, la scia, i bersagli e le scritte restano in
// SVG sopra la foto. Geometria (porta, dischetto, zone) in src/lib/penalty.ts.
//
// Usata da Rigori Duello e Sfide 1v1: riceve l'esito da animare e, quando non
// sta animando, mostra i sei bersagli nella porta.
// ============================================

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  ballTarget,
  GOAL,
  keeperZoneFor,
  OUTCOME_LABEL,
  SPOT,
  ZONE_LAYOUT,
  ZONE_POINT,
  type PenaltyOutcome,
  type PenaltyZone,
} from '@/lib/penalty';
import stadiumUrl from '@/assets/arena/stadium.webp';
import keeperIdle from '@/assets/arena/keeper-idle.webp';
import keeperTL from '@/assets/arena/keeper-TL.webp';
import keeperTC from '@/assets/arena/keeper-TC.webp';
import keeperTR from '@/assets/arena/keeper-TR.webp';
import keeperBL from '@/assets/arena/keeper-BL.webp';
import keeperBC from '@/assets/arena/keeper-BC.webp';
import keeperBR from '@/assets/arena/keeper-BR.webp';

export interface ArenaReveal {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  outcome: PenaltyOutcome;
}

interface PenaltyArenaProps {
  /** Esito da animare. null = scena in attesa (portiere sulla linea). */
  reveal: ArenaReveal | null;
  /** Cambia a ogni tiro: fa ripartire le animazioni anche con lo stesso esito. */
  revealKey: string | number;
  /** Bersagli nella porta: chi tira mira, chi para sceglie dove tuffarsi. */
  picking?: 'shoot' | 'keep' | null;
  picked?: PenaltyZone | null;
  disabled?: boolean;
  onPick?: (zone: PenaltyZone) => void;
  /** Contenuto extra sopra la scena (es. contatore). */
  children?: ReactNode;
  className?: string;
}

const VB_W = 400;
const VB_H = 300;

/** Riquadro (unita' del viewBox) in cui si disegna ogni posa del portiere. */
interface SpriteBox {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pose finali: i guanti arrivano sulla zona corrispondente (ZONE_POINT), i
 * piedi delle pose in piedi stanno sulla linea di porta. Le proporzioni
 * sono quelle delle immagini ritagliate.
 */
const KEEPER_IDLE_BOX: SpriteBox = { href: keeperIdle, x: 175, y: 86, w: 50, h: 88 };
const KEEPER_POSE: Record<PenaltyZone, SpriteBox> = {
  TL: { href: keeperTL, x: 92, y: 76, w: 92, h: 115 },
  TC: { href: keeperTC, x: 182, y: 70, w: 36, h: 112 },
  TR: { href: keeperTR, x: 210, y: 78, w: 100, h: 115 },
  BL: { href: keeperBL, x: 96, y: 108, w: 98, h: 62 },
  BC: { href: keeperBC, x: 171, y: 94, w: 58, h: 80 },
  BR: { href: keeperBR, x: 196, y: 116, w: 108, h: 55 },
};

export function PenaltyArena({
  reveal,
  revealKey,
  picking = null,
  picked = null,
  disabled = false,
  onPick,
  children,
  className,
}: PenaltyArenaProps) {
  const keeperZone = reveal ? keeperZoneFor(reveal.shot, reveal.keeper, reveal.outcome) : null;
  const pose = keeperZone ? KEEPER_POSE[keeperZone] : null;
  const target = reveal ? ballTarget(reveal.shot, reveal.outcome) : SPOT;
  const dx = target.x - SPOT.x;
  const dy = target.y - SPOT.y;
  const outcome = reveal?.outcome ?? null;
  const showTargets = !reveal && picking !== null;
  // Verso di rimbalzo dopo palo/parata: la palla torna verso il campo.
  const bounceX = reveal ? (reveal.shot.endsWith('L') ? -1 : reveal.shot.endsWith('R') ? 1 : 0) : 0;

  // La posa parte da dove sta il portiere in attesa e scivola nel suo riquadro.
  const idleCx = KEEPER_IDLE_BOX.x + KEEPER_IDLE_BOX.w / 2;
  const idleCy = KEEPER_IDLE_BOX.y + KEEPER_IDLE_BOX.h / 2;
  const poseStyle = pose
    ? ({
        '--from-x': `${idleCx - (pose.x + pose.w / 2)}px`,
        '--from-y': `${idleCy - (pose.y + pose.h / 2)}px`,
      } as CSSProperties)
    : undefined;
  const ballStyle = {
    '--bx': `${dx}px`,
    '--by': `${dy}px`,
    '--bounce-x': `${bounceX * 34}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'relative w-full select-none overflow-hidden rounded-3xl bg-[#070c18] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]',
        reveal && outcome !== 'goal' && 'animate-shake',
        className
      )}
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Stadio: porta, portiere e dischetto del rigore"
      >
        <defs>
          <radialGradient id="pa-ball" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#e6e9ef" />
            <stop offset="1" stopColor="#8b93a3" />
          </radialGradient>
          <radialGradient id="pa-flash" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.4" stopColor="#c7f56b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#c7f56b" stopOpacity="0" />
          </radialGradient>
          <filter id="pa-soft" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
          <clipPath id="pa-ball-clip">
            <circle cx="0" cy="0" r="13" />
          </clipPath>
        </defs>

        {/* Stadio: la foto copre tutta la scena, centrata sulla porta */}
        <image href={stadiumUrl} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />

        {/* Bersagli nella porta (solo quando si sceglie) */}
        {showTargets && (
          <g>
            {ZONE_LAYOUT.map(z => {
              const p = ZONE_POINT[z.zone];
              const on = picked === z.zone;
              return (
                <g key={z.zone} className="pointer-events-none">
                  <circle cx={p.x} cy={p.y} r="26" fill={on ? '#84d80c' : '#0b1220'} opacity={on ? 0.35 : 0.3} />
                  <circle cx={p.x} cy={p.y} r="26" fill="none" stroke={on ? '#d9ff8a' : '#ffffff'} strokeOpacity={on ? 1 : 0.9} strokeWidth={on ? 3 : 2} />
                  <circle cx={p.x} cy={p.y} r="13" fill="none" stroke={on ? '#d9ff8a' : '#ffffff'} strokeOpacity={on ? 1 : 0.65} strokeWidth="1.5" strokeDasharray="4 3" />
                  <circle cx={p.x} cy={p.y} r="4" fill={on ? '#d9ff8a' : '#ffffff'} />
                </g>
              );
            })}
          </g>
        )}

        {/* Portiere: ombra a terra, posa in attesa, posa del tuffo.
            Tutte le pose stanno nel DOM (nascoste) cosi' il browser le
            scarica subito e il tuffo non aspetta la rete. */}
        <ellipse
          cx={SPOT.x + 2}
          cy={GOAL.bottom + 1}
          rx="22"
          ry="4"
          fill="#000"
          opacity={pose ? 0.15 : 0.4}
          filter="url(#pa-soft)"
        />
        <image
          key={reveal ? `idle-out-${revealKey}` : 'idle'}
          href={KEEPER_IDLE_BOX.href}
          x={KEEPER_IDLE_BOX.x}
          y={KEEPER_IDLE_BOX.y}
          width={KEEPER_IDLE_BOX.w}
          height={KEEPER_IDLE_BOX.h}
          preserveAspectRatio="xMidYMax meet"
          className={reveal ? 'pa-sprite-out' : 'pa-sprite-idle'}
        />
        {(Object.keys(KEEPER_POSE) as PenaltyZone[]).map(z => {
          const b = KEEPER_POSE[z];
          const attiva = pose === b;
          return (
            <g key={attiva ? `pose-${z}-${revealKey}` : `pose-${z}`} className={attiva ? 'pa-sprite-dive' : undefined} style={attiva ? poseStyle : undefined} opacity={attiva ? 1 : 0}>
              <image href={b.href} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="xMidYMid meet" />
            </g>
          );
        })}

        {/* Scia e pallone */}
        {reveal && (
          <line
            key={`t-${revealKey}`}
            x1={SPOT.x}
            y1={SPOT.y - 8}
            x2={target.x}
            y2={target.y}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeOpacity="0.45"
            className="pa-trail"
            pathLength={100}
          />
        )}
        <g transform={`translate(${SPOT.x} ${SPOT.y})`}>
          <ellipse
            key={reveal ? `bs-${revealKey}` : 'bs-idle'}
            cx="0"
            cy="11"
            rx="12"
            ry="3.5"
            fill="#000"
            opacity="0.45"
            filter="url(#pa-soft)"
            className={reveal ? 'pa-ball-shadow-fly' : undefined}
            style={ballStyle}
          />
          <g key={reveal ? `b-${revealKey}` : 'b-idle'} className={reveal ? 'pa-ball-fly' : 'pa-ball-idle'} style={ballStyle}>
            <g className={cn(outcome === 'saved' && 'pa-ball-deflect', outcome === 'post' && 'pa-ball-post', outcome === 'miss' && 'pa-ball-miss')} style={ballStyle}>
              <g className={reveal ? 'pa-ball-spin' : undefined}>
                <circle cx="0" cy="0" r="13" fill="url(#pa-ball)" />
                <g clipPath="url(#pa-ball-clip)" fill="#1a1f2b">
                  <polygon points="0,-4.5 4.5,-1 3,4.5 -3,4.5 -4.5,-1" />
                  <polygon points="-12,-9 -6.5,-10 -5.5,-4.5 -10,-2" />
                  <polygon points="12,-9 6.5,-10 5.5,-4.5 10,-2" />
                  <polygon points="-8,12 -3.5,9 2,11 1,15 -5.5,15" />
                  <polygon points="10,9 13,5.5 15,11 12,14" />
                </g>
                <circle cx="0" cy="0" r="13" fill="none" stroke="#5b6270" strokeWidth="0.6" />
              </g>
            </g>
          </g>
        </g>

        {/* Lampo all'impatto */}
        {reveal && outcome === 'goal' && (
          <circle key={`f-${revealKey}`} cx={target.x} cy={target.y} r="44" fill="url(#pa-flash)" className="pa-flash" />
        )}
      </svg>

      {/* Bersagli cliccabili (HTML per accessibilita' e area tocco) */}
      {showTargets &&
        ZONE_LAYOUT.map(z => {
          const p = ZONE_POINT[z.zone];
          const on = picked === z.zone;
          return (
            <button
              key={z.zone}
              type="button"
              disabled={disabled}
              onClick={() => onPick?.(z.zone)}
              aria-label={picking === 'keep' ? `Tuffati ${z.label.toLowerCase()}` : `Tira ${z.label.toLowerCase()}`}
              aria-pressed={on}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform',
                'w-[17%] aspect-square',
                !disabled && 'hover:scale-110 active:scale-95',
                on && 'shadow-[0_0_28px_6px_rgba(132,216,12,0.45)]'
              )}
              style={{ left: `${(p.x / VB_W) * 100}%`, top: `${(p.y / VB_H) * 100}%` }}
            />
          );
        })}

      {/* Esito */}
      {reveal && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p
            key={`o-${revealKey}`}
            className={cn(
              'pa-slam font-display text-[clamp(28px,11vw,54px)] font-black uppercase italic tracking-tight drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]',
              outcome === 'goal' && 'text-primary-400',
              outcome === 'saved' && 'text-orange-400',
              outcome === 'post' && 'text-yellow-300',
              outcome === 'miss' && 'text-slate-200'
            )}
          >
            {OUTCOME_LABEL[reveal.outcome]}
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
