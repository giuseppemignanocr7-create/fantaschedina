import { Link } from 'react-router-dom';
import {
  ChevronRight, Swords, CircleDot, HelpCircle, RefreshCw, ShoppingBag,
  UserPlus, Clock, Zap,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { PushBanner } from '@/components/ui/PushToggle';
import { teamColor } from '@/lib/teamColors';
import { pickRichieste } from '@/lib/pickRichieste';
import { quoteAncoraAperte } from '@/lib/markets';
import { competitionName } from '@/lib/competitions';

// Le nove icone della home, nell'ordine chiesto dal regolamento di gioco
// (Giovanni, 01/09/2026): GIOCA al posto di PRONOSTICI, poi leghe, live,
// classifica, premi, minigiochi, l'archivio delle proprie fantaschedine,
// calendario e negozio.
//
// Grafica: tile a tinta piena con sfumatura verticale (c1 -> c2), emoji come
// icona e testo in `ink`, come da mockup del 09/09/2026.
const featureTiles = [
  {
    to: '/pronostici',
    label: 'GIOCA',
    sub: 'Crea il tuo pronostico',
    emoji: '🎯',
    c1: '#b9e08d',
    c2: '#8cc85a',
    ink: '#14532d',
  },
  {
    to: '/leghe',
    label: 'LEGHE',
    sub: 'Le tue leghe',
    emoji: '🏆',
    c1: '#2d74d6',
    c2: '#164a9e',
    ink: '#ffffff',
  },
  {
    to: '/live',
    label: 'LIVE',
    sub: 'Risultati in diretta',
    emoji: '📡',
    c1: '#e04340',
    c2: '#b01d1a',
    ink: '#ffffff',
  },
  {
    to: '/classifica',
    label: 'CLASSIFICA',
    sub: 'Scopri i migliori',
    emoji: '📈',
    c1: '#8b5cb8',
    c2: '#63398e',
    ink: '#ffffff',
  },
  {
    to: '/premi',
    label: 'PREMI',
    sub: 'I premi in palio',
    emoji: '🎁',
    c1: '#2f86e0',
    c2: '#175fb4',
    ink: '#ffffff',
  },
  {
    to: '/minigiochi',
    label: 'MINIGIOCHI',
    sub: 'Guadagna gettoni',
    emoji: '🎮',
    c1: '#f5ac36',
    c2: '#df8a0d',
    ink: '#ffffff',
  },
  {
    to: '/fantaschedine',
    // Trattino morbido: su una tile stretta va a capo come FANTA-SCHEDINE.
    label: 'LE MIE FANTA­SCHEDINE',
    sub: 'Le schedine giocate',
    emoji: '📋',
    c1: '#3f9de8',
    c2: '#1c76c4',
    ink: '#ffffff',
  },
  {
    to: '/calendario',
    label: 'CALENDARIO',
    sub: 'Tutti i match',
    emoji: '📅',
    c1: '#f6cb54',
    c2: '#e2a92c',
    ink: '#ffffff',
  },
  {
    to: '/negozio',
    label: 'NEGOZIO',
    sub: 'Spendi i tuoi gettoni',
    emoji: '🛍️',
    c1: '#ec4f9b',
    c2: '#cf2077',
    ink: '#ffffff',
  },
];

const quickActions = [
  { label: 'Rigori PvP', icon: CircleDot, to: '/minigiochi/rigori-duello' },
  { label: 'Quiz Calcio', icon: HelpCircle, to: '/minigiochi/quiz' },
  { label: 'Ruota', icon: RefreshCw, to: '/minigiochi/ruota' },
  { label: 'Sfide', icon: Swords, to: '/minigiochi' },
  { label: 'Premi', icon: ShoppingBag, to: '/premi' },
  { label: 'Invita', icon: UserPlus, to: '/community' },
];

// Carosello "guadagna gettoni" — tutte destinazioni reali
const earnCards = [
  { name: '🧠 QUIZ', tagline: 'FINO A 30 🪙 AL GIORNO', cta: 'GIOCA', c1: '#3f9de8', c2: '#1c76c4', to: '/minigiochi/quiz' },
  { name: '🎡 RUOTA', tagline: 'JACKPOT DA 100 🪙', cta: 'GIRA', c1: '#f5ac36', c2: '#df8a0d', to: '/minigiochi/ruota' },
  { name: '⚽ RIGORI', tagline: 'FINO A 50 🪙 A DUELLO', cta: 'TIRA', c1: '#3fc37e', c2: '#159a55', to: '/minigiochi/rigori-duello' },
  { name: '🎯 MISSIONI', tagline: 'FINO A 500 🪙 EXTRA', cta: 'SCOPRI', c1: '#ec4f9b', c2: '#cf2077', to: '/missioni' },
];

// Ombra morbida sotto le emoji delle tile: le stacca dal colore pieno
const ICON_SHADOW = 'drop-shadow(0 2px 3px rgba(0,0,0,0.28))';

export function DashboardPage() {
  const { currentMatchday, currentUser, currentSchedina, matchOdds, isLoadingOdds, refreshOdds } = useAppStore(useShallow(s => ({
      currentMatchday: s.currentMatchday,
      currentUser: s.currentUser,
      currentSchedina: s.currentSchedina,
      matchOdds: s.matchOdds,
      isLoadingOdds: s.isLoadingOdds,
      refreshOdds: s.refreshOdds,
    })));

  // Prossima partita non ancora giocata
  const nextMatch = currentMatchday?.matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]
    ?? currentMatchday?.matches[0];

  // Tutti i pronostici contano, di qualunque mercato: prima si contavano solo
  // gli 1X2, e il totale era il numero di partite invece dei pronostici richiesti.
  const predCount = (currentSchedina?.predictions ?? []).length;
  // Come il server: solo le partite quotate ancora in programma (qui basta lo
  // stato: la home non tiene un orologio). Una schedina inviata resta della sua misura.
  const total =
    currentSchedina?.isLocked && predCount > 0
      ? predCount
      : pickRichieste(quoteAncoraAperte(currentMatchday?.matches, matchOdds, 0));
  const nextEsito = nextMatch ? matchOdds[nextMatch.id]?.esito : undefined;
  const quoteEsito =
    nextEsito && (['1', 'X', '2'] as const).every(k => typeof nextEsito[k] === 'number')
      ? nextEsito
      : null;
  // Le giornate possono pescare da piu' campionati: l'intestazione dice quali.
  const campionati = [...new Set((currentMatchday?.matches ?? []).map(m => m.competition).filter((c): c is string => !!c))];
  const etichettaCampionati =
    campionati.length === 1 ? competitionName(campionati[0]).toUpperCase() : campionati.length > 1 ? 'PIÙ CAMPIONATI' : '';

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
      {/* ══ Fascia scura in alto: profilo + prossimo match su card bianche ══ */}
      <div className="relative bg-night rounded-b-[28px] shadow-lg shadow-black/25">
        <div
          className="absolute inset-0 rounded-b-[28px] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(ellipse 70% 90% at 50% -30%, rgba(132,216,12,0.14) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-2xl mx-auto px-4 pt-3 pb-5 space-y-3">

          {/* ── Riepilogo profilo (solo mobile) ── */}
          <div className="paper-card p-3 flex items-center gap-3 md:hidden">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-300 to-primary-600 ring-2 ring-white shadow-md flex items-center justify-center text-sm font-black text-white">
                {userInitials}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-display font-black text-sm text-paper-ink truncate">{currentUser?.username ?? 'Ospite'}</span>
                {currentUser && <span className="text-[10px] font-black bg-primary-500 text-night px-1.5 py-0.5 rounded uppercase flex-shrink-0">PRO</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-primary-700">{userPoints.toFixed(1)} pt</span>
                {predCount > 0 && (
                  <span className="text-[10px] text-paper-muted">
                    · Schedina: {predCount}/{total}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-base font-black text-paper-ink leading-none mb-1.5">#{userRank}</p>
              <Link
                to="/pronostici"
                className="inline-flex items-center gap-0.5 border border-paper-line rounded-lg px-2 py-1 text-[10px] font-black text-paper-ink hover:bg-paper transition-colors"
              >
                Pronostici <ChevronRight size={10} />
              </Link>
            </div>
          </div>

          {/* ── Prossimo Match / Schedina Status ── */}
          <div className="paper-card overflow-hidden">
            <div className="px-3 py-2.5">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">
                  {currentMatchday
                    ? `GIORNATA ${currentMatchday.number}${etichettaCampionati ? ` · ${etichettaCampionati}` : ''}`
                    : 'PROSSIMO MATCH'}
                </p>
                <button
                  onClick={refreshOdds}
                  disabled={isLoadingOdds}
                  className={cn(
                    'flex items-center gap-1 text-[10px] font-bold transition-all',
                    isLoadingOdds ? 'text-slate-600' : 'text-paper-muted hover:text-blue-700'
                  )}
                >
                  <RefreshCw size={9} className={cn(isLoadingOdds && 'animate-spin')} />
                  {isLoadingOdds ? 'Aggiorno...' : 'Aggiorna quote'}
                </button>
              </div>

              {nextMatch ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black italic text-[15px] leading-tight whitespace-nowrap">
                      <span style={{ color: teamColor(nextMatch.homeTeam.id) }}>{nextMatch.homeTeam.shortName}</span>
                      <span className="text-slate-600 font-medium not-italic text-[11px]"> vs </span>
                      <span style={{ color: teamColor(nextMatch.awayTeam.id) }}>{nextMatch.awayTeam.shortName}</span>
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-paper-muted whitespace-nowrap">
                      <Clock size={9} className="flex-shrink-0" />
                      <span className="truncate">{formatMatchTime(nextMatch.scheduledAt)}</span>
                    </div>
                  </div>

                  {quoteEsito ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(['1','X','2'] as const).map(k => (
                        <div key={k} className="flex flex-col items-center bg-white border border-paper-line rounded-lg px-1.5 py-1 min-w-[31px]">
                          <span className="text-[10px] text-paper-muted font-bold leading-none">{k}</span>
                          <span className="text-[11px] font-mono font-black text-blue-600 leading-tight">
                            {quoteEsito[k].toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-paper-muted flex-shrink-0">Quota non disponibile</span>
                  )}

                  <Link
                    to="/pronostici"
                    className="flex-shrink-0 flex items-center justify-center gap-0.5 bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-night font-black text-[11px] uppercase tracking-wide px-2.5 py-2.5 rounded-xl transition-all shadow-md shadow-primary-500/40 text-center"
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
                <p className="text-paper-muted text-sm">Nessuna partita disponibile</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ══ Area chiara: tile colorate e sezioni gettoni ══ */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <PushBanner />

        {/* ── Griglia delle nove icone ── */}
        <div className="grid grid-cols-4 gap-2.5">
          {featureTiles.map((tile, ti) => {
            // La tile è larga ~78px su un telefono da 375px. Le etichette non
            // scendono sotto i 10px (prima arrivavano a 7.5, illeggibili): la
            // parola lunga va a capo sul trattino morbido, e il sottotitolo
            // compare solo dove la tile è abbastanza larga da contenerlo.
            return (
              <Link
                key={tile.to}
                to={tile.to}
                className="feature-tile aspect-square animate-pop-in"
                style={{
                  backgroundImage: `linear-gradient(180deg, ${tile.c1} 0%, ${tile.c2} 100%)`,
                  animationDelay: `${ti * 50}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <span className="text-[26px] leading-none" style={{ filter: ICON_SHADOW }} aria-hidden>
                  {tile.emoji}
                </span>
                <div className="w-full text-center">
                  <p className="font-black uppercase leading-[1.1] tracking-tight text-[10px]" style={{ color: tile.ink }}>
                    {tile.label}
                  </p>
                  <p className="hidden sm:block text-[10px] leading-[1.15] mt-0.5" style={{ color: tile.ink, opacity: 0.82 }}>
                    {tile.sub}
                  </p>
                </div>
                <ChevronRight size={12} className="tile-chevron" style={{ color: tile.ink }} />
              </Link>
            );
          })}

          {/* Barra "guadagna gettoni", accanto al NEGOZIO come da mockup */}
          <Link
            to="/minigiochi"
            className="col-span-3 self-center paper-card px-3 py-2.5 flex items-center gap-2 hover:border-primary-500/50 transition-colors"
          >
            <span className="text-base leading-none flex-shrink-0">🪙</span>
            <span className="section-title-ink flex-1 tracking-[0.08em] whitespace-nowrap">Guadagna Gettoni</span>
            <span className="text-[10px] font-black text-primary-700 flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap">
              Sala giochi <ChevronRight size={11} />
            </span>
          </Link>
        </div>

        {/* ── Carosello guadagna gettoni ── */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
          {earnCards.map((s, si) => (
            <Link
              key={s.name}
              to={s.to}
              className="relative flex-shrink-0 w-[148px] rounded-2xl p-3.5 flex flex-col overflow-hidden shadow-[0_5px_16px_rgba(15,23,42,0.16)] hover:scale-[1.03] active:scale-95 transition-transform animate-slide-up"
              style={{
                backgroundImage: `linear-gradient(180deg, ${s.c1} 0%, ${s.c2} 100%)`,
                animationDelay: `${si * 70}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 bottom-0 w-10 bg-white/10 animate-shine" style={{ animationDelay: `${si * 800}ms` }} />
              </div>
              <p className="font-black text-[15px] leading-none text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>{s.name}</p>
              <p className="text-[10px] text-white/85 mt-1 mb-2.5 leading-snug flex-1">{s.tagline}</p>
              <span className="self-start text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-white/90 text-slate-800">
                {s.cta} →
              </span>
            </Link>
          ))}
        </div>

        {/* ── Azioni Rapide ── */}
        <div className="paper-card p-4">
          <p className="section-title-ink mb-3">Azioni Rapide</p>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-0.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex-shrink-0 flex flex-col items-center gap-2 group"
                >
                  <div className="w-11 h-11 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center group-hover:bg-primary-500/30 group-hover:border-primary-600 transition-all duration-200">
                    <Icon size={18} className="text-primary-700" strokeWidth={1.9} />
                  </div>
                  <span className="text-[10px] text-paper-muted group-hover:text-paper-ink text-center whitespace-nowrap transition-colors">{action.label}</span>
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
