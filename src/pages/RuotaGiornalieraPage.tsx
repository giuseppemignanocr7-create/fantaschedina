import { useState, useRef } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { spinWheel, callableErrorMessage } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { useAuthContext } from '@/contexts/AuthContext';
import { CountUp } from '@/components/ui/CountUp';
import { jackpotCelebration, coinRain, burstConfetti, vibrate } from '@/lib/juice';

const COLORS = ['#1a44cc', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#facc15'];
const TEXTS = ['#fff', '#fff', '#000', '#fff', '#fff', '#000', '#000', '#000'];

// Spicchi allineati a COINS.wheelPrizes (l'esito è deciso dal server)
const SEGMENTS = COINS.wheelPrizes.map((pts, i) => ({
  label: pts >= 150 ? `JACKPOT ${pts} 🏆` : `+${pts} 🪙`,
  pts,
  color: COLORS[i % COLORS.length],
  text: TEXTS[i % TEXTS.length],
}));

const N = SEGMENTS.length;
const SEG_DEG = 360 / N;

export function RuotaGiornalieraPage() {
  const { refreshProfile } = useAuthContext();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [alreadySpun, setAlreadySpun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevRotation = useRef(0);

  const spin = async () => {
    if (spinning || alreadySpun) return;
    setError(null);
    try {
      // L'esito è estratto server-side, il client anima soltanto
      const { segmentIndex } = await spinWheel();
      const extra = 360 * 7;
      const segOffset = segmentIndex * SEG_DEG + SEG_DEG / 2;
      const target =
        prevRotation.current + extra + (360 - (prevRotation.current % 360)) + (360 - segOffset);
      prevRotation.current = target;
      setRotation(target);
      setSpinning(true);
      setResult(null);
      setTimeout(() => {
        setSpinning(false);
        setResult(segmentIndex);
        setAlreadySpun(true);
        refreshProfile();
        const pts = SEGMENTS[segmentIndex].pts;
        vibrate([50, 30, 80]);
        if (pts >= 150) jackpotCelebration();
        else if (pts >= 50) { burstConfetti(); coinRain(1300); }
        else coinRain(900);
      }, 5000);
    } catch (e) {
      const msg = callableErrorMessage(e);
      setError(msg);
      if (msg.includes('già giocato')) setAlreadySpun(true);
    }
  };

  const prize = result !== null ? SEGMENTS[result] : null;

  const conicGradient = SEGMENTS.map((s, i) => {
    const start = i * SEG_DEG;
    const end = start + SEG_DEG;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/minigiochi" className="p-2 text-white/40 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-display font-black text-xl text-white uppercase">Ruota Giornaliera</h1>
            <p className="text-[10px] text-white/40">1 giro gratuito ogni giorno</p>
          </div>
        </div>

        {/* Wheel container */}
        <div className="flex flex-col items-center gap-5">
          {/* Pointer + LED frame */}
          <div className="relative p-4">
            {/* LED lights around the wheel */}
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i / 16) * 2 * Math.PI;
              return (
                <div
                  key={i}
                  className={cn('absolute w-2.5 h-2.5 rounded-full z-10', spinning ? 'animate-led-blink' : 'animate-pulse')}
                  style={{
                    left: `calc(50% + ${Math.cos(a) * 158}px - 5px)`,
                    top: `calc(50% + ${Math.sin(a) * 158}px - 5px)`,
                    backgroundColor: i % 2 === 0 ? '#fbbf24' : '#fde68a',
                    boxShadow: `0 0 8px 2px ${i % 2 === 0 ? '#fbbf2488' : '#fde68a55'}`,
                    animationDelay: `${(i % 4) * 200}ms`,
                  }}
                />
              );
            })}

            {/* Arrow pointing down to wheel */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 z-20 w-0 h-0 drop-shadow-lg"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '24px solid #fbbf24',
              }} />

            {/* Wheel */}
            <div
              className="relative w-72 h-72 rounded-full shadow-2xl shadow-black/60 ring-8 ring-yellow-900/60"
              style={{
                background: `conic-gradient(${conicGradient})`,
                transition: spinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                transform: `rotate(${rotation}deg)`,
                boxShadow: spinning
                  ? '0 0 60px -10px #fbbf2477, 0 25px 50px -12px rgba(0,0,0,0.6)'
                  : '0 0 30px -12px #fbbf2444, 0 25px 50px -12px rgba(0,0,0,0.6)',
              }}
            >
              {/* Segment dividers + labels */}
              {SEGMENTS.map((seg, i) => {
                const angle = i * SEG_DEG + SEG_DEG / 2;
                const rad = (angle - 90) * (Math.PI / 180);
                const r = 85;
                const x = 50 + r * Math.cos(rad);
                const y = 50 + r * Math.sin(rad);
                return (
                  <div
                    key={i}
                    className="absolute font-black text-[9px] leading-tight text-center pointer-events-none select-none"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                      color: seg.text,
                      width: '48px',
                    }}
                  >
                    {seg.label}
                  </div>
                );
              })}

              {/* Center */}
              <div className="absolute inset-[35%] rounded-full bg-background flex items-center justify-center shadow-lg ring-4 ring-yellow-500/30">
                <RefreshCw size={22} className={cn('text-yellow-400', spinning && 'animate-spin')} />
              </div>
            </div>
          </div>

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={spinning || alreadySpun}
            className={cn(
              'w-full py-4 rounded-2xl font-black text-base uppercase tracking-wide transition-all',
              spinning ? 'bg-white/10 text-white/40 cursor-not-allowed'
              : alreadySpun ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
              : 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-orange-500 text-black shadow-lg shadow-yellow-500/40 hover:shadow-yellow-500/70 active:scale-[0.97] animate-pulse-glow'
            )}
          >
            {spinning ? '🌀 La ruota gira…' : alreadySpun ? '✓ Già girato oggi' : '🎡 GIRA LA RUOTA'}
          </button>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          {alreadySpun && !spinning && (
            <p className="text-xs text-white/30 text-center">Torna domani per un nuovo giro gratuito!</p>
          )}
        </div>

        {/* Result */}
        {prize && !spinning && (
          <div
            className="glass-card p-6 text-center space-y-2 border animate-pop-in relative overflow-hidden"
            style={{ borderColor: `${prize.color}70`, boxShadow: `0 0 40px -10px ${prize.color}66` }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 bottom-0 w-24 bg-white/10 animate-shine" />
            </div>
            <p className="text-6xl animate-heartbeat">{prize.pts >= 150 ? '🏆' : prize.pts >= 50 ? '🎉' : '🪙'}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">{prize.pts >= 150 ? 'JACKPOT!!!' : 'Hai vinto'}</p>
            <p className="font-black text-5xl animate-coin-pop" style={{ color: prize.color }}>
              +<CountUp to={prize.pts} durationMs={1200} /> 🪙
            </p>
            <p className="text-sm text-white/60">gettoni aggiunti al tuo portafoglio</p>
          </div>
        )}

        {/* Prizes list */}
        <div className="glass-card p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3 font-bold">Premi disponibili</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SEGMENTS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-white/3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-white/70 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
