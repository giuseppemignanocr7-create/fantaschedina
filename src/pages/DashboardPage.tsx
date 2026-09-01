import { Link } from 'react-router-dom';
import {
  Target, Trophy, TrendingUp, Gift, Calendar, Gamepad2, Radio, ClipboardList,
  ChevronRight, Swords, CircleDot, HelpCircle, RefreshCw, ShoppingBag,
  UserPlus, Clock, Zap,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

// Le nove icone della home, nell'ordine chiesto dal regolamento di gioco
// (Giovanni, 01/09/2026): GIOCA al posto di PRONOSTICI, poi leghe, live,
// classifica, premi, minigiochi, l'archivio delle proprie fantaschedine,
// calendario e negozio.
const featureTiles = [
  {
    to: '/pronostici',
    label: 'GIOCA',
    sub: 'Crea il tuo pronostico',
    icon: Target,
    bg: '#0d2515',
    iconColor: '#22c55e',
    border: '#1a4a2a',
  },
  {
    to: '/leghe',
    label: 'LEGHE',
    sub: 'Le tue leghe',
    icon: Trophy,
    bg: '#0d1a3a',
    iconColor: '#fbbf24',
    border: '#1a2e5a',
  },
  {
    to: '/live',
    label: 'LIVE',
    sub: 'Risultati in diretta',
    icon: Radio,
    bg: '#2a0a0a',
    iconColor: '#f87171',
    border: '#4a1a1a',
  },
  {
    to: '/classifica',
    label: 'CLASSIFICA',
    sub: 'Scopri i migliori',
    icon: TrendingUp,
    bg: '#1a0d3a',
    iconColor: '#a78bfa',
    border: '#2e1a5a',
  },
  {
    to: '/premi',
    label: 'PREMI',
    sub: 'I premi in palio',
    icon: Gift,
    bg: '#001a1a',
    iconColor: '#22d3ee',
    border: '#003030',
  },
  {
    to: '/minigiochi',
    label: 'MINIGIOCHI',
    sub: 'Guadagna gettoni',
    icon: Gamepad2,
    bg: '#2a1400',
    iconColor: '#fb923c',
    border: '#4a2a00',
  },
  {
    to: '/fantaschedine',
    label: 'LE MIE FANTASCHEDINE',
    sub: 'Le schedine giocate',
    icon: ClipboardList,
    bg: '#001028',
    iconColor: '#60a5fa',
    border: '#002048',
  },
  {
    to: '/calendario',
    label: 'CALENDARIO',
    sub: 'Tutti i match',
    icon: Calendar,
    bg: '#1a1500',
    iconColor: '#facc15',
    border: '#3a3000',
  },
  {
    to: '/negozio',
    label: 'NEGOZIO',
    sub: 'Spendi i tuoi gettoni',
    icon: ShoppingBag,
    bg: '#1a0028',
    iconColor: '#f472b6',
    border: '#350050',
  },
];

const quickActions = [
  { label: 'Rigori PvP', icon: CircleDot, to: '/minigiochi/rigori' },
  { label: 'Quiz Calcio', icon: HelpCircle, to: '/minigiochi/quiz' },
  { label: 'Ruota', icon: RefreshCw, to: '/minigiochi/ruota' },
  { label: 'Sfide', icon: Swords, to: '/minigiochi' },
  { label: 'Premi', icon: ShoppingBag, to: '/premi' },
  { label: 'Invita', icon: UserPlus, to: '/community' },
];

// Carosello "guadagna gettoni" — tutte destinazioni reali
const earnCards = [
  { name: '🧠 QUIZ', tagline: 'FINO A 30 🪙 AL GIORNO', cta: 'GIOCA', bg: '#0a1a3a', accent: '#60a5fa', to: '/minigiochi/quiz' },
  { name: '🎡 RUOTA', tagline: 'JACKPOT DA 100 🪙', cta: 'GIRA', bg: '#2a1a00', accent: '#fbbf24', to: '/minigiochi/ruota' },
  { name: '⚽ RIGORI', tagline: 'FINO A 10 🪙 A PARTITA', cta: 'TIRA', bg: '#0a2a1a', accent: '#34d399', to: '/minigiochi/rigori' },
  { name: '🎯 MISSIONI', tagline: 'FINO A 500 🪙 EXTRA', cta: 'SCOPRI', bg: '#2a0a1a', accent: '#f472b6', to: '/missioni' },
];

export function DashboardPage() {
  const { currentMatchday, currentUser, currentSchedina, matchOdds, isLoadingOdds, refreshOdds } = useAppStore();

  // Prossima partita non ancora giocata
  const nextMatch = currentMatchday?.matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]
    ?? currentMatchday?.matches[0];

  const predCount = (currentSchedina?.predictions || []).filter(p => p.betType === 'esito').length;
  const total = currentMatchday?.matches.length || 10;
  const nextOdds = nextMatch ? matchOdds[nextMatch.id] : null;

  const formatMatchTime = (d: Date) => {
    const now = new Date();
    const dt = new Date(d);
    const diffDays = Math.round((dt.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
    const timeStr = new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Oggi — ${timeStr}`;
    if (diffDays === 1) return `Domani — ${timeStr}`;
    return new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) + ` — ${timeStr}`;
  };

  const userInitials = currentUser?.username?.slice(0, 2).toUpperCase() ?? 'FM';
  const userPoints = currentUser?.totalPoints ?? 0;
  const userRank = currentUser?.rank ?? '—';

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ── Mobile profile summary ── */}
        <div className="glass-card p-3 flex items-center gap-3 md:hidden">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border-2 border-primary-500/40 flex items-center justify-center text-sm font-black text-white">
              {userInitials}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-display font-black text-sm text-white">{currentUser?.username ?? 'Ospite'}</span>
              {currentUser && <span className="text-[8px] font-black bg-primary-500/20 text-primary-400 px-1 py-0.5 rounded border border-primary-500/30 uppercase">PRO</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-primary-400">{userPoints.toFixed(1)} pt</span>
              {predCount > 0 && (
                <span className="text-[10px] text-white/40">
                  · Schedina: {predCount}/{total}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black text-white">#{userRank}</p>
            <Link to="/pronostici" className="text-[9px] font-black text-primary-400 hover:text-primary-300 flex items-center gap-0.5 justify-end mt-0.5">
              Pronostici <ChevronRight size={9} />
            </Link>
          </div>
        </div>

        {/* ── Prossimo Match / Schedina Status (compatto) ── */}
        <div className="relative glass-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary-500 via-primary-400 to-transparent" />
          <div className="px-3 py-2.5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[8px] font-black text-primary-400 uppercase tracking-[0.25em]">
                {currentMatchday ? `GIORNATA ${currentMatchday.number} · SERIE A` : 'PROSSIMO MATCH'}
              </p>
              <button
                onClick={refreshOdds}
                disabled={isLoadingOdds}
                className={cn(
                  'flex items-center gap-1 text-[8px] font-bold transition-all',
                  isLoadingOdds ? 'text-white/20' : 'text-white/30 hover:text-accent-400'
                )}
              >
                <RefreshCw size={8} className={cn(isLoadingOdds && 'animate-spin')} />
                {isLoadingOdds ? 'Aggiorno...' : 'Aggiorna quote'}
              </button>
            </div>

            {nextMatch ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-base text-white leading-tight truncate">
                    {nextMatch.homeTeam.shortName} <span className="text-white/40 font-medium">vs</span> {nextMatch.awayTeam.shortName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
                    <Clock size={10} />
                    <span>{formatMatchTime(nextMatch.scheduledAt)}</span>
                  </div>
                </div>

                {nextOdds && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(['1','X','2'] as const).map(k => (
                      <div key={k} className="flex flex-col items-center bg-white/5 rounded-lg px-2 py-1 min-w-[34px]">
                        <span className="text-[7px] text-white/30 font-bold">{k}</span>
                        <span className="text-[11px] font-mono font-black text-accent-400">
                          {nextOdds.esito[k].toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  to="/pronostici"
                  className="flex-shrink-0 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-background font-black text-[10px] uppercase tracking-wide px-3 py-2 rounded-xl transition-all shadow-lg shadow-primary-500/25 text-center"
                >
                  {predCount > 0 ? (
                    <>
                      <Zap size={12} />
                      <span>{predCount}/{total}</span>
                    </>
                  ) : (
                    <>
                      <span>GIOCA</span>
                      <ChevronRight size={12} />
                    </>
                  )}
                </Link>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Nessuna partita disponibile</p>
            )}
          </div>
        </div>

        {/* ── Feature Tiles Grid ── */}
        <div className="grid grid-cols-4 gap-2.5">
          {featureTiles.map((tile, ti) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.to}
                to={tile.to}
                className="feature-tile aspect-square animate-pop-in hover:scale-[1.06] hover:-translate-y-0.5 active:scale-95 transition-transform duration-150"
                style={{
                  backgroundColor: tile.bg,
                  border: `1px solid ${tile.border}`,
                  boxShadow: `0 4px 20px ${tile.iconColor}14`,
                  animationDelay: `${ti * 50}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <Icon size={28} style={{ color: tile.iconColor }} strokeWidth={1.8} />
                <div className="text-center">
                  <p className="text-[10px] font-black text-white uppercase leading-tight tracking-wide">{tile.label}</p>
                  <p className="text-[8px] leading-tight mt-0.5" style={{ color: `${tile.iconColor}80` }}>{tile.sub}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Guadagna Gettoni ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="section-title">🪙 Guadagna Gettoni</p>
            <Link to="/minigiochi" className="text-[10px] text-primary-400 hover:text-primary-300 flex items-center gap-0.5 transition-colors">
              Sala giochi <ChevronRight size={11} />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {earnCards.map((s, si) => (
              <Link
                key={s.name}
                to={s.to}
                className="relative flex-shrink-0 w-[148px] rounded-2xl p-3.5 border border-white/8 flex flex-col overflow-hidden hover:scale-[1.03] active:scale-95 transition-transform animate-slide-up"
                style={{ backgroundColor: s.bg, animationDelay: `${si * 70}ms`, animationFillMode: 'backwards' }}
              >
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-0 bottom-0 w-10 bg-white/5 animate-shine" style={{ animationDelay: `${si * 800}ms` }} />
                </div>
                <p className="font-black text-[15px] leading-none" style={{ color: s.accent }}>{s.name}</p>
                <p className="text-[9px] text-white/55 mt-1 mb-2.5 leading-snug flex-1">{s.tagline}</p>
                <span
                  className="self-start text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all"
                  style={{ borderColor: `${s.accent}50`, color: s.accent, backgroundColor: `${s.accent}12` }}
                >
                  {s.cta} →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Azioni Rapide ── */}
        <div className="glass-card p-4">
          <p className="section-title mb-3">Azioni Rapide</p>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-0.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex-shrink-0 flex flex-col items-center gap-2 group"
                >
                  <div className="w-11 h-11 rounded-full bg-primary-500/12 border border-primary-500/20 flex items-center justify-center group-hover:bg-primary-500/25 group-hover:border-primary-500/40 group-hover:shadow-lg group-hover:shadow-primary-500/15 transition-all duration-200">
                    <Icon size={18} className="text-primary-400" strokeWidth={1.8} />
                  </div>
                  <span className="text-[9px] text-white/50 group-hover:text-white/80 text-center whitespace-nowrap transition-colors">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="h-2" />

      </div>
    </div>
  );
}
