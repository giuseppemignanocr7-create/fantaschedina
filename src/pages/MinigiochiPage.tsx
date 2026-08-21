import { Link } from 'react-router-dom';
import { Gamepad2, Coins, Zap } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { COINS } from '@/lib/economy';

interface Game {
  emoji: string;
  name: string;
  tagline: string;
  desc: string;
  gradient: string;
  glow: string;
  color: string;
  cta: string;
  to: string;
  pts: string;
}

const games: Game[] = [
  {
    emoji: '🧠',
    name: 'QUIZ CALCIO',
    tagline: 'Sei un vero intenditore?',
    desc: '10 domande, 15 secondi ciascuna. Ogni risposta giusta vale oro.',
    gradient: 'linear-gradient(135deg, #0c2a6e 0%, #113a9e 45%, #0a1a44 100%)',
    glow: '#3b82f6',
    color: '#60a5fa',
    cta: 'GIOCA ORA',
    to: '/minigiochi/quiz',
    pts: `fino a ${COINS.quizMaxQuestions * COINS.quizPerCorrect} 🪙`,
  },
  {
    emoji: '🎡',
    name: 'RUOTA DELLA FORTUNA',
    tagline: 'Tenta il JACKPOT!',
    desc: 'Un giro gratis al giorno. Vinci fino al super premio.',
    gradient: 'linear-gradient(135deg, #7a4a00 0%, #b8860b 45%, #4a2d00 100%)',
    glow: '#f59e0b',
    color: '#fbbf24',
    cta: 'GIRA!',
    to: '/minigiochi/ruota',
    pts: `fino a ${Math.max(...COINS.wheelPrizes)} 🪙`,
  },
  {
    emoji: '🥅',
    name: 'RIGORI DUELLO',
    tagline: 'Realtime 1vs1 / Bot',
    desc: '3 mirini, 5 secondi, 5 rigori a testa. Sei attaccante o portiere.',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #0d9488 45%, #022c22 100%)',
    glow: '#14b8a6',
    color: '#2dd4bf',
    cta: 'DUELLA!',
    to: '/minigiochi/rigori-duello',
    pts: `${COINS.duelWin} 🪙 a vittoria (max ${COINS.duelDailyCap}/giorno)`,
  },
  {
    emoji: '⚔️',
    name: 'SFIDE 1VS1',
    tagline: 'Cinque rigori a testa',
    desc: 'Scegli un avversario e tira: il suo portiere para come giocano le sue statistiche.',
    gradient: 'linear-gradient(135deg, #3b1060 0%, #6d28d9 45%, #23074d 100%)',
    glow: '#a855f7',
    color: '#c084fc',
    cta: 'SFIDA!',
    to: '/minigiochi/sfide',
    pts: `fino a ${COINS.sfidaMaxReward} 🪙`,
  },
  {
    emoji: '🃏',
    name: 'MEMORIA CALCIO',
    tagline: 'Trova le coppie!',
    desc: 'Memory game con emoji calcistiche. 3 livelli di difficoltà, timer e bonus velocità.',
    gradient: 'linear-gradient(135deg, #0a3d2e 0%, #1a6b4f 45%, #06291c 100%)',
    glow: '#22c55e',
    color: '#86efac',
    cta: 'GIOCA!',
    to: '/minigiochi/memoria',
    pts: `fino a ${COINS.memoriaDailyCap} 🪙`,
  },
];

export function MinigiochiPage() {
  const { profile } = useAuthContext();
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Header arcade */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 size={22} className="text-orange-400 animate-wiggle" />
            <h1 className="page-title">SALA GIOCHI</h1>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl animate-pulse-glow">
            <Coins size={14} className="text-yellow-400" />
            <span className="font-black text-sm text-yellow-400">{profile?.coins ?? 0}</span>
          </div>
        </div>

        {/* Banner premio */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 bottom-0 w-24 bg-white/10 animate-shine" />
          </div>
          <div className="flex items-center gap-3">
            <Zap size={22} className="text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-white/70 leading-relaxed">
              Ogni giorno <span className="text-yellow-400 font-black">quiz e ruota gratis</span>, rigori <span className="text-yellow-400 font-black">senza limiti</span>: vinci{' '}
              <span className="text-yellow-400 font-black">gettoni 🪙</span> e compra{' '}
              <span className="text-primary-400 font-black">power-up</span> per dominare la schedina!
            </p>
          </div>
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 gap-4">
          {games.map((g, gi) => {
            const isDisabled = g.to === '#';
            const card = (
              <div
                className="relative rounded-3xl p-5 overflow-hidden transition-all duration-200 group"
                style={{
                  background: g.gradient,
                  boxShadow: isDisabled ? 'none' : `0 8px 32px -8px ${g.glow}55`,
                  border: `1px solid ${g.glow}40`,
                  animationDelay: `${gi * 80}ms`,
                }}
              >
                {/* shine sweep */}
                {!isDisabled && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 bottom-0 w-20 bg-white/10 animate-shine" style={{ animationDelay: `${gi * 600}ms` }} />
                  </div>
                )}
                {/* big floating emoji */}
                <div
                  className="absolute -right-3 -bottom-5 text-[92px] leading-none opacity-25 group-hover:opacity-40 transition-opacity select-none animate-float"
                  style={{ animationDelay: `${gi * 400}ms` }}
                >
                  {g.emoji}
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{g.emoji}</span>
                    <div>
                      <p className="font-display font-black text-lg text-white tracking-wide">{g.name}</p>
                      <p className="text-[11px] font-bold" style={{ color: g.color }}>{g.tagline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 leading-snug max-w-[75%]">{g.desc}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/30 border"
                      style={{ color: g.color, borderColor: `${g.glow}50` }}
                    >
                      {g.pts}
                    </span>
                    <span
                      className={
                        isDisabled
                          ? 'text-[10px] font-black uppercase px-4 py-2.5 rounded-xl text-white/40 bg-black/30 border border-white/10'
                          : 'text-[11px] font-black uppercase px-5 py-2.5 rounded-xl text-white bg-white/15 border border-white/30 backdrop-blur-sm group-hover:bg-white/25 group-hover:scale-105 transition-all shadow-lg'
                      }
                    >
                      {g.cta}
                    </span>
                  </div>
                </div>
              </div>
            );
            return isDisabled ? (
              <div key={g.name} className="animate-slide-up opacity-80">{card}</div>
            ) : (
              <Link key={g.name} to={g.to} className="animate-slide-up active:scale-[0.98] transition-transform block">
                {card}
              </Link>
            );
          })}
        </div>

        {/* Come usare i gettoni */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-yellow-400" />
            <p className="font-black text-sm text-white">Come usare i gettoni 🪙</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Link to="/schedina" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98]">
              <span className="text-2xl">🃏</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Jolly Raddoppio</p>
                <p className="text-[10px] text-white/50">Raddoppia i punti di un pronostico vinto</p>
              </div>
              <span className="text-xs font-black text-yellow-400 flex-shrink-0">200🪙</span>
            </Link>
            <Link to="/schedina" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98]">
              <span className="text-2xl">🛡️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Scudo</p>
                <p className="text-[10px] text-white/50">Annulla le penalità delle quote basse</p>
              </div>
              <span className="text-xs font-black text-yellow-400 flex-shrink-0">150🪙</span>
            </Link>
            <Link to="/schedina" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98]">
              <span className="text-2xl">⭐</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Assicurazione</p>
                <p className="text-[10px] text-white/50">Con 8/10 corretti ricevi il bonus del 9/10</p>
              </div>
              <span className="text-xs font-black text-yellow-400 flex-shrink-0">120🪙</span>
            </Link>
          </div>
          <Link to="/schedina" className="block text-center btn-green text-xs font-black py-2.5 active:scale-95 transition-transform">
            🎫 VAI ALLA SCHEDINA
          </Link>
        </div>

        <div className="glass-card p-4 text-center">
          <p className="text-3xl mb-2 animate-float inline-block">🕹️</p>
          <p className="font-bold text-white">Nuovi giochi in arrivo!</p>
          <p className="text-xs text-white/40 mt-1">La sala giochi si espande ogni settimana</p>
        </div>
      </div>
    </div>
  );
}
