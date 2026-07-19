import { Calendar, Clock } from 'lucide-react';

const matchdays = [
  {
    round: 'Giornata 18',
    date: 'Sabato 24 Maggio',
    matches: [
      { home: 'Inter', away: 'Milan', time: '20:45', status: 'live', score: '1-0' },
      { home: 'Juventus', away: 'Napoli', time: '15:00', status: 'upcoming', score: null },
      { home: 'Torino', away: 'Bologna', time: '18:00', status: 'upcoming', score: null },
    ],
  },
  {
    round: 'Giornata 18',
    date: 'Domenica 25 Maggio',
    matches: [
      { home: 'Roma', away: 'Lazio', time: '18:00', status: 'upcoming', score: null },
      { home: 'Atalanta', away: 'Fiorentina', time: '20:45', status: 'upcoming', score: null },
      { home: 'Udinese', away: 'Verona', time: '15:00', status: 'upcoming', score: null },
    ],
  },
];

export function MatchPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <Calendar size={20} className="text-primary-400" />
          <h1 className="page-title">MATCH</h1>
        </div>

        {matchdays.map((day, i) => (
          <div key={i} className="space-y-2">
            <p className="section-title">{day.date}</p>
            {day.matches.map((m, j) => (
              <div key={j} className="glass-card p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{m.home}</span>
                    {m.status === 'live' ? (
                      <span className="font-black text-base text-primary-400 mx-2">{m.score}</span>
                    ) : (
                      <div className="flex items-center gap-1 mx-2 text-xs text-white/40">
                        <Clock size={11} />
                        <span>{m.time}</span>
                      </div>
                    )}
                    <span className="font-bold text-sm text-white">{m.away}</span>
                  </div>
                </div>
                {m.status === 'live' && (
                  <span className="flex-shrink-0 text-[9px] font-black text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
