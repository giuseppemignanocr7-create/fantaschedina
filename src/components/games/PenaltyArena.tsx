// ============================================
// FANTA SCHEDINA - PENALTY ARENA
// Stadio notturno in SVG (nessuna dipendenza, nessuna immagine): prato a
// strisce in prospettiva, tribune, tabellone, porta con rete in profondita',
// portiere articolato che si tuffa verso la zona scelta, pallone che vola con
// scia e finisce in rete, sul palo, fuori o tra i guanti. Le pose e i punti
// d'arrivo stanno in src/lib/penalty.ts; qui c'e' solo il disegno.
//
// Usata da Rigori Duello e Sfide 1v1: la scena riceve l'esito da animare e,
// quando non sta animando, mostra i sei bersagli nella porta.
// ============================================

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  ballTarget,
  GOAL,
  KEEPER_DIVE,
  KEEPER_IDLE,
  OUTCOME_LABEL,
  SPOT,
  ZONE_LAYOUT,
  ZONE_POINT,
  type PenaltyOutcome,
  type PenaltyZone,
} from '@/lib/penalty';

export interface ArenaReveal {
  shot: PenaltyZone;
  keeper: PenaltyZone;
  outcome: PenaltyOutcome;
}

interface PenaltyArenaProps {
  /** Esito da animare. null = scena in attesa (portiere che balla sulla linea). */
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

/** Colori maglie della folla: pochi, ripetuti, come una curva vera. */
const CROWD = ['#3b4a6b', '#6b7a99', '#c9a227', '#8a2f2f', '#2e6b3f', '#d8dce6'];

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
  const pose = reveal ? KEEPER_DIVE[reveal.keeper] : KEEPER_IDLE;
  const target = reveal ? ballTarget(reveal.shot, reveal.outcome) : SPOT;
  const dx = target.x - SPOT.x;
  const dy = target.y - SPOT.y;
  const outcome = reveal?.outcome ?? null;
  const showTargets = !reveal && picking !== null;
  // Verso di rimbalzo dopo palo/parata: la palla torna verso il campo.
  const bounceX = reveal ? (reveal.shot.endsWith('L') ? -1 : reveal.shot.endsWith('R') ? 1 : 0) : 0;

  const keeperStyle = {
    '--kx': `${pose.x}px`,
    '--ky': `${pose.y}px`,
    '--kr': `${pose.rot}deg`,
  } as CSSProperties;
  const armLStyle = { '--arm': `${pose.armL}deg`, '--arm0': `${KEEPER_IDLE.armL}deg` } as CSSProperties;
  const armRStyle = { '--arm': `${pose.armR}deg`, '--arm0': `${KEEPER_IDLE.armR}deg` } as CSSProperties;
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
          <linearGradient id="pa-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05080f" />
            <stop offset="1" stopColor="#141f3d" />
          </linearGradient>
          <radialGradient id="pa-flood" cx="0.5" cy="0" r="0.8">
            <stop offset="0" stopColor="#fff7d6" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#fff7d6" stopOpacity="0.08" />
            <stop offset="1" stopColor="#fff7d6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pa-grass-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f8f3f" />
            <stop offset="1" stopColor="#1f6b2e" />
          </linearGradient>
          <linearGradient id="pa-grass-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3aa34c" />
            <stop offset="1" stopColor="#257a36" />
          </linearGradient>
          <linearGradient id="pa-post" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9aa3b2" />
            <stop offset="0.35" stopColor="#ffffff" />
            <stop offset="1" stopColor="#8d96a6" />
          </linearGradient>
          <linearGradient id="pa-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#8d96a6" />
          </linearGradient>
          <pattern id="pa-net" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 3.5 H7 M3.5 0 V7" stroke="#e5e9f2" strokeWidth="0.7" strokeOpacity="0.55" />
          </pattern>
          <pattern id="pa-crowd" width="23" height="9" patternUnits="userSpaceOnUse">
            {CROWD.map((c, i) => (
              <circle key={c} cx={1.5 + i * 3.7 + (i % 2) * 0.6} cy={2 + (i % 3) * 0.5} r="1.15" fill={c} />
            ))}
            {CROWD.map((c, i) => (
              <circle key={`b-${c}`} cx={3.3 + ((i * 5 + 2) % 6) * 3.7} cy={6.5 + (i % 2) * 0.6} r="1.15" fill={CROWD[(i + 3) % CROWD.length]} />
            ))}
          </pattern>
          <linearGradient id="pa-stand-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05080f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#05080f" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="pa-ball" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#e6e9ef" />
            <stop offset="1" stopColor="#8b93a3" />
          </radialGradient>
          <linearGradient id="pa-kit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb02e" />
            <stop offset="1" stopColor="#e2770b" />
          </linearGradient>
          <linearGradient id="pa-glove" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c7f56b" />
            <stop offset="1" stopColor="#6db300" />
          </linearGradient>
          <radialGradient id="pa-flash" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.4" stopColor="#c7f56b" stopOpacity="0.5" />
            <stop offset="1" stopColor="#c7f56b" stopOpacity="0" />
          </radialGradient>
          <clipPath id="pa-ball-clip">
            <circle cx="0" cy="0" r="12" />
          </clipPath>
        </defs>

        {/* Cielo e luci dello stadio */}
        <rect width={VB_W} height={VB_H} fill="url(#pa-sky)" />
        <rect x="-60" y="-40" width="300" height="220" fill="url(#pa-flood)" />
        <rect x="160" y="-40" width="300" height="220" fill="url(#pa-flood)" />
        <g fill="#0b1224">
          <rect x="18" y="0" width="4" height="46" />
          <rect x="378" y="0" width="4" height="46" />
          <rect x="8" y="0" width="24" height="7" rx="2" fill="#1b2744" />
          <rect x="368" y="0" width="24" height="7" rx="2" fill="#1b2744" />
        </g>
        <g fill="#fff3c4" opacity="0.9">
          <rect x="10" y="2" width="20" height="3" rx="1" className="pa-lamp" />
          <rect x="370" y="2" width="20" height="3" rx="1" className="pa-lamp" />
        </g>

        {/* Tribune: due anelli, folla a puntini */}
        <polygon points="0,52 400,52 400,150 0,150" fill="#10182c" />
        <polygon points="0,56 400,56 400,96 0,96" fill="url(#pa-crowd)" opacity="0.85" />
        <rect x="0" y="96" width="400" height="6" fill="#1b2542" />
        <polygon points="0,102 400,102 400,148 0,148" fill="url(#pa-crowd)" opacity="0.7" />
        <rect x="0" y="52" width="400" height="98" fill="url(#pa-stand-shade)" />
        {/* flash dei tifosi */}
        <g className="pa-flashes" fill="#ffffff">
          <circle cx="62" cy="70" r="1.6" style={{ animationDelay: '0s' }} />
          <circle cx="318" cy="118" r="1.6" style={{ animationDelay: '0.9s' }} />
          <circle cx="140" cy="128" r="1.4" style={{ animationDelay: '1.7s' }} />
          <circle cx="355" cy="64" r="1.4" style={{ animationDelay: '2.4s' }} />
          <circle cx="240" cy="72" r="1.4" style={{ animationDelay: '3.1s' }} />
        </g>

        {/* Tabellone pubblicitario dietro la porta */}
        <rect x="0" y="150" width="400" height="20" fill="#0b1a12" />
        <rect x="0" y="150" width="400" height="20" fill="#84d80c" opacity="0.12" />
        <g fontFamily="Montserrat, system-ui, sans-serif" fontWeight="900" fontSize="9" fill="#9be32a" letterSpacing="2">
          <text x="14" y="164">FANTASCHEDINA</text>
          <text x="152" y="164" opacity="0.6">•</text>
          <text x="170" y="164">FANTASCHEDINA</text>
          <text x="308" y="164" opacity="0.6">•</text>
          <text x="326" y="164">FANTA</text>
        </g>

        {/* Prato a strisce in prospettiva */}
        <polygon points="0,170 400,170 400,300 0,300" fill="url(#pa-grass-a)" />
        {Array.from({ length: 9 }).map((_, i) => {
          if (i % 2 === 0) return null;
          const farW = 400 / 9;
          const nearW = 640 / 9;
          const fx = i * farW;
          const nx = -120 + i * nearW;
          return (
            <polygon
              key={i}
              points={`${fx},170 ${fx + farW},170 ${nx + nearW},300 ${nx},300`}
              fill="url(#pa-grass-b)"
            />
          );
        })}
        {/* Linee: fondo, area piccola, dischetto, lunetta */}
        <g stroke="#f4f7ff" strokeOpacity="0.85" fill="none" strokeWidth="2" strokeLinejoin="round">
          <line x1="0" y1="178" x2="400" y2="178" />
          <polyline points="40,178 20,246 380,246 360,178" />
          <path d="M120 300 Q200 268 280 300" strokeOpacity="0.6" />
        </g>
        <circle cx={SPOT.x} cy={SPOT.y} r="3" fill="#f4f7ff" opacity="0.9" />

        {/* Porta: rete di fondo, fianchi, tetto, poi i pali davanti */}
        <g className={cn('pa-net', reveal && outcome === 'goal' && 'pa-net-bulge')}>
          <polygon points="118,100 282,100 282,172 118,172" fill="#0a1020" opacity="0.55" />
          <polygon points="118,100 282,100 282,172 118,172" fill="url(#pa-net)" />
          <polygon points={`${GOAL.left},${GOAL.top} 118,100 118,172 ${GOAL.left},${GOAL.bottom}`} fill="url(#pa-net)" opacity="0.8" />
          <polygon points={`${GOAL.right},${GOAL.top} 282,100 282,172 ${GOAL.right},${GOAL.bottom}`} fill="url(#pa-net)" opacity="0.8" />
          <polygon points={`${GOAL.left},${GOAL.top} ${GOAL.right},${GOAL.top} 282,100 118,100`} fill="url(#pa-net)" opacity="0.7" />
        </g>
        {/* ombra della porta sul prato */}
        <polygon points={`${GOAL.left},${GOAL.bottom} ${GOAL.right},${GOAL.bottom} 318,196 82,196`} fill="#000" opacity="0.18" />
        <g>
          <rect x={GOAL.left - 4} y={GOAL.top - 4} width="8" height={GOAL.bottom - GOAL.top + 4} rx="3" fill="url(#pa-post)" />
          <rect x={GOAL.right - 4} y={GOAL.top - 4} width="8" height={GOAL.bottom - GOAL.top + 4} rx="3" fill="url(#pa-post)" />
          <rect x={GOAL.left - 4} y={GOAL.top - 4} width={GOAL.right - GOAL.left + 8} height="8" rx="3" fill="url(#pa-bar)" />
        </g>

        {/* Portiere */}
        <g transform={`translate(${SPOT.x} ${GOAL.bottom})`}>
          <ellipse
            key={reveal ? `sh-${revealKey}` : 'sh-idle'}
            cx="0"
            cy="1"
            rx="17"
            ry="4"
            fill="#000"
            opacity="0.4"
            className={reveal ? 'pa-keeper-shadow-dive' : undefined}
            style={keeperStyle}
          />
          <g transform="scale(1.12)">
          <g
            key={reveal ? `k-${revealKey}` : 'k-idle'}
            className={reveal ? 'pa-keeper-dive' : 'pa-keeper-idle'}
            style={keeperStyle}
          >
            {/* gambe */}
            <rect x="-10" y="-36" width="7" height="34" rx="3" fill="#1d2b4c" />
            <rect x="3" y="-36" width="7" height="34" rx="3" fill="#1d2b4c" />
            <rect x="-11" y="-6" width="9" height="6" rx="2" fill="#0d1428" />
            <rect x="2" y="-6" width="9" height="6" rx="2" fill="#0d1428" />
            {/* pantaloncini */}
            <rect x="-13" y="-42" width="26" height="14" rx="4" fill="#111a33" />
            {/* maglia */}
            <path d="M-15 -70 Q0 -76 15 -70 L17 -40 L-17 -40 Z" fill="url(#pa-kit)" />
            <text x="0" y="-50" textAnchor="middle" fontSize="12" fontWeight="900" fill="#111a33" fontFamily="Montserrat, system-ui, sans-serif">1</text>
            {/* braccia con guanti */}
            {/* L'attributo transform e l'animazione CSS non convivono sullo
                stesso elemento: la traslazione sta sul gruppo esterno. */}
            <g transform="translate(-14 -66)">
              <g className={reveal ? 'pa-arm-dive' : 'pa-arm-idle'} style={armLStyle}>
                <rect x="-3.5" y="0" width="7" height="30" rx="3.5" fill="#f0a11a" />
                <circle cx="0" cy="32" r="6.5" fill="url(#pa-glove)" stroke="#2f5300" strokeWidth="0.8" />
              </g>
            </g>
            <g transform="translate(14 -66)">
              <g className={reveal ? 'pa-arm-dive' : 'pa-arm-idle'} style={armRStyle}>
                <rect x="-3.5" y="0" width="7" height="30" rx="3.5" fill="#f0a11a" />
                <circle cx="0" cy="32" r="6.5" fill="url(#pa-glove)" stroke="#2f5300" strokeWidth="0.8" />
              </g>
            </g>
            {/* testa */}
            <circle cx="0" cy="-80" r="9.5" fill="#e7b688" />
            <path d="M-9.5 -82 Q0 -94 9.5 -82 Q4 -86 0 -86 Q-4 -86 -9.5 -82 Z" fill="#2b1d12" />
          </g>
          </g>
        </g>

        {/* Bersagli nella porta (solo quando si sceglie) */}
        {showTargets && (
          <g>
            {ZONE_LAYOUT.map(z => {
              const p = ZONE_POINT[z.zone];
              const on = picked === z.zone;
              return (
                <g key={z.zone} className="pointer-events-none">
                  <circle cx={p.x} cy={p.y} r="19" fill={on ? '#84d80c' : '#ffffff'} opacity={on ? 0.28 : 0.08} />
                  <circle cx={p.x} cy={p.y} r="19" fill="none" stroke={on ? '#c7f56b' : '#ffffff'} strokeOpacity={on ? 1 : 0.5} strokeWidth={on ? 2.5 : 1.5} strokeDasharray={on ? undefined : '4 3'} />
                  <circle cx={p.x} cy={p.y} r="4" fill={on ? '#c7f56b' : '#ffffff'} opacity={on ? 1 : 0.6} />
                </g>
              );
            })}
          </g>
        )}

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
            cy="10"
            rx="11"
            ry="3.5"
            fill="#000"
            opacity="0.45"
            className={reveal ? 'pa-ball-shadow-fly' : undefined}
            style={ballStyle}
          />
          <g key={reveal ? `b-${revealKey}` : 'b-idle'} className={reveal ? 'pa-ball-fly' : 'pa-ball-idle'} style={ballStyle}>
            <g className={cn(outcome === 'saved' && 'pa-ball-deflect', outcome === 'post' && 'pa-ball-post', outcome === 'miss' && 'pa-ball-miss')} style={ballStyle}>
              <g className={reveal ? 'pa-ball-spin' : undefined}>
                <circle cx="0" cy="0" r="12" fill="url(#pa-ball)" />
                <g clipPath="url(#pa-ball-clip)" fill="#1a1f2b">
                  <polygon points="0,-4 4,-1 2.5,4 -2.5,4 -4,-1" />
                  <polygon points="-11,-8 -6,-9 -5,-4 -9,-2" />
                  <polygon points="11,-8 6,-9 5,-4 9,-2" />
                  <polygon points="-7,11 -3,8 2,10 1,14 -5,14" />
                  <polygon points="9,8 12,5 14,10 11,13" />
                </g>
                <circle cx="0" cy="0" r="12" fill="none" stroke="#5b6270" strokeWidth="0.6" />
              </g>
            </g>
          </g>
        </g>

        {/* Lampo all'impatto */}
        {reveal && outcome === 'goal' && (
          <circle key={`f-${revealKey}`} cx={target.x} cy={target.y} r="40" fill="url(#pa-flash)" className="pa-flash" />
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
                'w-[16%] aspect-square',
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
