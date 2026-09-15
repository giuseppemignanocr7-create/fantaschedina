// ============================================
// RUOTA GIORNALIERA
// Un giro gratis al giorno. L'esito lo estrae il server (`wheel_spin`): qui la
// ruota si limita a fermarsi sullo spicchio deciso. Disegno in SVG: spicchi a
// prato con le linee bianche del campo, premi scritti dentro lo spicchio,
// cerchione con la cucitura del pallone e pallone al centro come mozzo.
// ============================================

import { useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { spinWheel, callableErrorMessage } from '@/lib/gameApi';
import { COINS } from '@/lib/economy';
import { CountUp } from '@/components/ui/CountUp';
import { jackpotCelebration, coinRain, burstConfetti, vibrate } from '@/lib/juice';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';
import { Ruota, RUOTA_SEGMENTS as SEGMENTS, RUOTA_SEG_DEG as SEG_DEG, RUOTA_SPIN_MS } from '@/components/games/Ruota';

const JACKPOT = Math.max(...COINS.wheelPrizes);
const SPIN_MS = RUOTA_SPIN_MS;

export function RuotaGiornalieraPage() {
  const refreshProfileSilently = useSilentProfileRefresh('RuotaGiornalieraPage');
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
      vibrate(20);
      setTimeout(() => {
        setSpinning(false);
        setResult(segmentIndex);
        setAlreadySpun(true);
        refreshProfileSilently();
        const pts = SEGMENTS[segmentIndex].pts;
        vibrate([50, 30, 80]);
        if (SEGMENTS[segmentIndex].jackpot) jackpotCelebration();
        else if (pts >= 50) {
          burstConfetti();
          coinRain(1300);
        } else coinRain(900);
      }, SPIN_MS);
    } catch (e) {
      const msg = callableErrorMessage(e);
      setError(msg);
      if (msg.includes('già giocato')) setAlreadySpun(true);
    }
  };

  const prize = result !== null ? SEGMENTS[result] : null;

  return (
    <div className="min-h-screen">
      {/* Fascia scura: la ruota sotto i riflettori, come la testata della home */}
      <div className="relative bg-night rounded-b-[28px] shadow-lg shadow-black/25 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(132,216,12,0.16) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-md mx-auto px-4 pt-3 pb-6 space-y-2">
          <header className="flex items-center gap-3">
            <Link to="/minigiochi" className="p-2 -ml-2 text-white/70 hover:text-white transition-colors" aria-label="Torna ai minigiochi">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="font-display font-black text-xl text-white uppercase tracking-wide">Ruota Giornaliera</h1>
              <p className="text-[11px] text-white/60">Un giro gratis al giorno · fino a {JACKPOT} gettoni</p>
            </div>
          </header>

          <Ruota rotation={rotation} spinning={spinning} />

          <button
            onClick={spin}
            disabled={spinning || alreadySpun}
            className={cn(
              'w-full py-4 rounded-2xl font-black text-base uppercase tracking-wide transition-all',
              spinning
                ? 'bg-white/10 text-white/60 cursor-not-allowed'
                : alreadySpun
                  ? 'bg-white/10 text-white/60 cursor-not-allowed border border-white/10'
                  : 'bg-primary-500 text-night shadow-lg shadow-primary-500/40 hover:bg-primary-400 active:scale-[0.97] animate-pulse-glow'
            )}
          >
            {spinning ? '🌀 La ruota gira…' : alreadySpun ? '✓ Già girato oggi' : '⚽ GIRA LA RUOTA'}
          </button>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          {alreadySpun && !spinning && !prize && (
            <p className="text-xs text-white/60 text-center">Torna domani per un nuovo giro gratuito.</p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        {prize && !spinning && (
          <div className="paper-card p-6 text-center space-y-2 animate-pop-in relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 bottom-0 w-24 bg-primary-500/15 animate-shine" />
            </div>
            <p className="text-6xl animate-heartbeat">{prize.jackpot ? '🏆' : prize.pts >= 50 ? '🎉' : '🪙'}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{prize.jackpot ? 'JACKPOT!!!' : 'Hai vinto'}</p>
            <p className={cn('font-black text-5xl animate-coin-pop', prize.jackpot ? 'text-yellow-600' : 'text-primary-700')}>
              +<CountUp to={prize.pts} durationMs={1200} /> 🪙
            </p>
            <p className="text-sm text-slate-500">gettoni aggiunti al tuo portafoglio</p>
            <Link to="/negozio" className="inline-block mt-2 text-xs font-black text-primary-700 hover:underline">
              Spendili nel negozio →
            </Link>
          </div>
        )}

        <div className="paper-card p-4 space-y-1.5">
          <p className="section-title-ink">Come funziona</p>
          <p className="text-xs text-slate-600">
            Un giro gratis al giorno, si rinnova a mezzanotte. I premi sono scritti sugli spicchi: da{' '}
            <b>{Math.min(...COINS.wheelPrizes)}</b> a <b>{JACKPOT}</b> gettoni, e lo spicchio d'oro è il jackpot.
          </p>
        </div>
      </div>
    </div>
  );
}
