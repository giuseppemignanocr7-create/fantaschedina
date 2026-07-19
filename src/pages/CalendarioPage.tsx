import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const rounds = [
  { n: 16, status: 'done' as const },
  { n: 17, status: 'done' as const },
  { n: 18, status: 'current' as const },
  { n: 19, status: 'upcoming' as const },
  { n: 20, status: 'upcoming' as const },
];

const matches = [
  { home: 'Inter', away: 'Milan', date: 'Sab 24 Mag', time: '20:45', homeScore: null, awayScore: null },
  { home: 'Juventus', away: 'Napoli', date: 'Dom 25 Mag', time: '15:00', homeScore: null, awayScore: null },
  { home: 'Roma', away: 'Lazio', date: 'Dom 25 Mag', time: '18:00', homeScore: null, awayScore: null },
  { home: 'Atalanta', away: 'Fiorentina', date: 'Dom 25 Mag', time: '20:45', homeScore: null, awayScore: null },
  { home: 'Torino', away: 'Bologna', date: 'Sab 24 Mag', time: '15:00', homeScore: null, awayScore: null },
  { home: 'Udinese', away: 'Verona', date: 'Sab 24 Mag', time: '18:00', homeScore: null, awayScore: null },
  { home: 'Empoli', away: 'Lecce', date: 'Dom 25 Mag', time: '12:30', homeScore: null, awayScore: null },
  { home: 'Genoa', away: 'Cagliari', date: 'Sab 24 Mag', time: '12:30', homeScore: null, awayScore: null },
  { home: 'Monza', away: 'Venezia', date: 'Dom 25 Mag', time: '15:00', homeScore: null, awayScore: null },
  { home: 'Como', away: 'Parma', date: 'Dom 25 Mag', time: '18:00', homeScore: null, awayScore: null },
];

export function CalendarioPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Calendar size={20} className="text-yellow-400" />
          <h1 className="page-title">CALENDARIO</h1>
        </div>

        {/* Round selector */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {rounds.map((r) => (
              <button
                key={r.n}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all',
                  r.status === 'current'
                    ? 'bg-primary-500 text-white'
                    : r.status === 'done'
                    ? 'bg-white/10 text-white/60'
                    : 'bg-white/5 text-white/30'
                )}
              >
                G{r.n}
              </button>
            ))}
          </div>
          <button className="p-2 text-white/40 hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Current round header */}
        <div className="glass-card p-3 flex items-center justify-between">
          <div>
            <p className="font-display font-black text-base text-white uppercase">Giornata 18</p>
            <p className="text-xs text-white/40">24-25 Maggio 2026</p>
          </div>
          <span className="text-[10px] font-black text-primary-400 bg-primary-500/15 border border-primary-500/30 px-2.5 py-1 rounded-full">
            IN CORSO
          </span>
        </div>

        {/* Matches */}
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div key={i} className="glass-card p-3 flex items-center gap-3">
              <div className="flex-1 flex items-center justify-between">
                <span className="font-bold text-sm text-white flex-1 text-right">{m.home}</span>
                <div className="mx-3 text-center min-w-[50px]">
                  {m.homeScore !== null ? (
                    <span className="font-black text-base text-white">
                      {m.homeScore} - {m.awayScore}
                    </span>
                  ) : (
                    <span className="text-xs text-white/40 font-bold">{m.time}</span>
                  )}
                  <p className="text-[8px] text-white/20">{m.date}</p>
                </div>
                <span className="font-bold text-sm text-white flex-1">{m.away}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
