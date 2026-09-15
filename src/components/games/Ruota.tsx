// ============================================
// FANTA SCHEDINA - RUOTA (disegno)
// La ruota dei premi in SVG, senza logica di gioco: spicchi a prato con le
// linee bianche del campo, premi scritti dentro lo spicchio lungo il raggio,
// cerchione con la cucitura del pallone e pallone al centro come mozzo.
// L'esito lo decide il server; qui arriva solo l'angolo a cui fermarsi.
// ============================================

import { COINS } from '@/lib/economy';

const JACKPOT = Math.max(...COINS.wheelPrizes);

// Spicchi allineati a COINS.wheelPrizes (l'esito e' deciso dal server)
export const RUOTA_SEGMENTS = COINS.wheelPrizes.map((pts, i) => {
  const jackpot = pts === JACKPOT;
  const grande = !jackpot && pts >= 50;
  return {
    pts,
    jackpot,
    fill: jackpot ? 'url(#rw-gold)' : grande ? '#84d80c' : i % 2 === 0 ? '#2e8b3f' : '#226f31',
    ink: jackpot || grande ? '#0f172a' : '#ffffff',
  };
});

const N = RUOTA_SEGMENTS.length;
export const RUOTA_SEG_DEG = 360 / N;
export const RUOTA_SPIN_MS = 5200;
const R = 150;
const CX = 160;
const CY = 160;

function polar(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Spicchio i: da (i*45) a ((i+1)*45) gradi, con lo 0 in alto e verso orario. */
function segmentPath(i: number) {
  const a0 = i * RUOTA_SEG_DEG - 90;
  const a1 = a0 + RUOTA_SEG_DEG;
  const p0 = polar(a0, R);
  const p1 = polar(a1, R);
  return `M${CX},${CY} L${p0.x},${p0.y} A${R},${R} 0 0 1 ${p1.x},${p1.y} Z`;
}

interface RuotaProps {
  /** Angolo corrente in gradi (cresce a ogni giro). */
  rotation: number;
  /** Con true la rotazione e' animata fino a fermarsi. */
  spinning: boolean;
}

export function Ruota({ rotation, spinning }: RuotaProps) {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
            <svg viewBox="-12 -20 344 352" className="w-full h-auto drop-shadow-[0_24px_36px_rgba(0,0,0,0.6)]" role="img" aria-label="Ruota dei premi">
              <defs>
                <linearGradient id="rw-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffe08a" />
                  <stop offset="0.5" stopColor="#f5b731" />
                  <stop offset="1" stopColor="#c98a05" />
                </linearGradient>
                <radialGradient id="rw-shade" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0.6" stopColor="#000" stopOpacity="0" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.45" />
                </radialGradient>
                <radialGradient id="rw-ball" cx="0.35" cy="0.3" r="0.8">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.65" stopColor="#e6e9ef" />
                  <stop offset="1" stopColor="#8b93a3" />
                </radialGradient>
                <linearGradient id="rw-rim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#334155" />
                  <stop offset="1" stopColor="#0b1220" />
                </linearGradient>
                <clipPath id="rw-ball-clip">
                  <circle cx={CX} cy={CY} r="30" />
                </clipPath>
              </defs>

              {/* Ruota (gira) */}
              <g
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: `${CX}px ${CY}px`,
                  transition: spinning ? `transform ${RUOTA_SPIN_MS}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : 'none',
                }}
              >
                {RUOTA_SEGMENTS.map((s, i) => (
                  <path key={i} d={segmentPath(i)} fill={s.fill} />
                ))}
                {/* erba: leggera vignettatura verso il bordo */}
                <circle cx={CX} cy={CY} r={R} fill="url(#rw-shade)" />
                {/* linee del campo fra gli spicchi */}
                {RUOTA_SEGMENTS.map((_, i) => {
                  const p = polar(i * RUOTA_SEG_DEG - 90, R);
                  return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#f8fafc" strokeWidth="2.5" strokeOpacity="0.9" />;
                })}
                {/* premi dentro lo spicchio, scritti lungo il raggio */}
                {RUOTA_SEGMENTS.map((s, i) => {
                  const mid = i * RUOTA_SEG_DEG - 90 + RUOTA_SEG_DEG / 2;
                  const p = polar(mid, 98);
                  return (
                    <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${mid + 90})`} fill={s.ink} textAnchor="middle" fontFamily="Montserrat, system-ui, sans-serif">
                      {s.jackpot ? (
                        <>
                          <text y="-14" fontSize="9" fontWeight="900" letterSpacing="1.5">JACKPOT</text>
                          <text y="10" fontSize="24" fontWeight="900">{s.pts}</text>
                          <text y="22" fontSize="7" fontWeight="700" letterSpacing="1">GETTONI</text>
                        </>
                      ) : (
                        <>
                          <text y="6" fontSize="24" fontWeight="900">+{s.pts}</text>
                          <text y="19" fontSize="7" fontWeight="700" letterSpacing="1" opacity="0.85">GETTONI</text>
                        </>
                      )}
                    </g>
                  );
                })}
                {/* cerchione con la cucitura del pallone */}
                <circle cx={CX} cy={CY} r={R + 1} fill="none" stroke="url(#rw-rim)" strokeWidth="14" />
                <circle cx={CX} cy={CY} r={R + 1} fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeDasharray="3 5" strokeOpacity="0.55" />
                {RUOTA_SEGMENTS.map((_, i) => {
                  const p = polar(i * RUOTA_SEG_DEG - 90, R + 1);
                  return <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#cbd5e1" stroke="#0b1220" strokeWidth="1" />;
                })}
                {/* mozzo: pallone */}
                <circle cx={CX} cy={CY} r="36" fill="#0b1220" />
                <circle cx={CX} cy={CY} r="30" fill="url(#rw-ball)" />
                <g clipPath="url(#rw-ball-clip)" fill="#1a1f2b" transform={`translate(${CX} ${CY})`}>
                  <polygon points="0,-9 9,-2.5 5.5,8 -5.5,8 -9,-2.5" />
                  <polygon points="-26,-19 -14,-22 -11,-10 -20,-5 -29,-10" />
                  <polygon points="26,-19 14,-22 11,-10 20,-5 29,-10" />
                  <polygon points="-17,26 -7,19 4,23 3,32 -12,33" />
                  <polygon points="21,19 29,12 33,24 26,31" />
                  <polygon points="0,-31 8,-27 6,-19 -6,-19 -8,-27" />
                </g>
                <circle cx={CX} cy={CY} r="30" fill="none" stroke="#5b6270" strokeWidth="0.8" />
              </g>

              {/* Indice fisso in alto */}
              <polygon points={`${CX},22 ${CX - 15},-12 ${CX + 15},-12`} fill="#f8fafc" stroke="#0b1220" strokeWidth="2" strokeLinejoin="round" />
              <polygon points={`${CX},12 ${CX - 7},-8 ${CX + 7},-8`} fill="#84d80c" />
            </svg>
          </div>

  );
}
