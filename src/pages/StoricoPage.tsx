import { useState } from 'react';
import { 
  Calendar,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Trophy,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';

type FilterType = 'tutti' | 'vinte' | 'perse';

export function StoricoPage() {
  const { currentUser } = useAppStore();
  const [filter, setFilter] = useState<FilterType>('tutti');
  const [expandedMatchday, setExpandedMatchday] = useState<number | null>(null);

  if (!currentUser) {
    return null;
  }

  // Mock storico schedine
  const storicoSchedine = [
    {
      matchday: 17,
      date: '25/01/2026',
      totalPoints: 4.8,
      correctPredictions: 7,
      bonusPoints: 0,
      penaltyPoints: 0,
      isWinner: false,
      predictions: [
        { home: 'Juventus', away: 'Napoli', prediction: '1', result: '1', odds: 2.10, correct: true },
        { home: 'Inter', away: 'Milan', prediction: 'X', result: '2', odds: 3.40, correct: false },
        { home: 'Roma', away: 'Lazio', prediction: '1', result: '1', odds: 2.30, correct: true },
        { home: 'Atalanta', away: 'Fiorentina', prediction: '1', result: '1', odds: 1.75, correct: true },
        { home: 'Bologna', away: 'Torino', prediction: 'X', result: 'X', odds: 3.20, correct: true },
        { home: 'Udinese', away: 'Genoa', prediction: '1', result: '1', odds: 1.90, correct: true },
        { home: 'Verona', away: 'Monza', prediction: '2', result: '1', odds: 2.80, correct: false },
        { home: 'Empoli', away: 'Lecce', prediction: 'X', result: 'X', odds: 3.10, correct: true },
        { home: 'Cagliari', away: 'Parma', prediction: '1', result: '2', odds: 2.20, correct: false },
        { home: 'Como', away: 'Venezia', prediction: '1', result: '1', odds: 2.00, correct: true },
      ]
    },
    {
      matchday: 16,
      date: '18/01/2026',
      totalPoints: 5.2,
      correctPredictions: 8,
      bonusPoints: 0,
      penaltyPoints: 0,
      isWinner: true,
      predictions: [
        { home: 'Napoli', away: 'Inter', prediction: '1', result: '1', odds: 2.40, correct: true },
        { home: 'Milan', away: 'Juventus', prediction: 'X', result: 'X', odds: 3.30, correct: true },
        { home: 'Lazio', away: 'Atalanta', prediction: '2', result: '2', odds: 2.50, correct: true },
        { home: 'Fiorentina', away: 'Roma', prediction: '1', result: '1', odds: 2.10, correct: true },
        { home: 'Torino', away: 'Bologna', prediction: '1', result: 'X', odds: 2.00, correct: false },
        { home: 'Genoa', away: 'Udinese', prediction: 'X', result: 'X', odds: 3.00, correct: true },
        { home: 'Monza', away: 'Verona', prediction: '1', result: '1', odds: 2.20, correct: true },
        { home: 'Lecce', away: 'Empoli', prediction: '2', result: '2', odds: 2.60, correct: true },
        { home: 'Parma', away: 'Cagliari', prediction: '1', result: '2', odds: 2.30, correct: false },
        { home: 'Venezia', away: 'Como', prediction: 'X', result: 'X', odds: 3.20, correct: true },
      ]
    },
    {
      matchday: 15,
      date: '11/01/2026',
      totalPoints: 3.9,
      correctPredictions: 6,
      bonusPoints: 0,
      penaltyPoints: 0,
      isWinner: false,
      predictions: [
        { home: 'Inter', away: 'Napoli', prediction: '1', result: 'X', odds: 1.80, correct: false },
        { home: 'Juventus', away: 'Milan', prediction: '1', result: '1', odds: 2.10, correct: true },
        { home: 'Atalanta', away: 'Lazio', prediction: '1', result: '1', odds: 1.90, correct: true },
        { home: 'Roma', away: 'Fiorentina', prediction: '1', result: '1', odds: 2.00, correct: true },
        { home: 'Bologna', away: 'Torino', prediction: '1', result: '2', odds: 2.10, correct: false },
        { home: 'Udinese', away: 'Genoa', prediction: '1', result: '1', odds: 1.85, correct: true },
        { home: 'Verona', away: 'Monza', prediction: 'X', result: '1', odds: 3.00, correct: false },
        { home: 'Empoli', away: 'Lecce', prediction: '1', result: '1', odds: 2.20, correct: true },
        { home: 'Cagliari', away: 'Parma', prediction: 'X', result: '2', odds: 3.10, correct: false },
        { home: 'Como', away: 'Venezia', prediction: '1', result: '1', odds: 2.05, correct: true },
      ]
    },
    {
      matchday: 14,
      date: '04/01/2026',
      totalPoints: 6.1,
      correctPredictions: 9,
      bonusPoints: 2,
      penaltyPoints: 0,
      isWinner: true,
      predictions: []
    },
    {
      matchday: 13,
      date: '22/12/2025',
      totalPoints: 4.2,
      correctPredictions: 7,
      bonusPoints: 0,
      penaltyPoints: 0,
      isWinner: false,
      predictions: []
    },
  ];

  const filteredSchedine = storicoSchedine.filter(s => {
    if (filter === 'vinte') return s.isWinner;
    if (filter === 'perse') return !s.isWinner;
    return true;
  });

  const totalStats = {
    totalSchedine: storicoSchedine.length,
    wins: storicoSchedine.filter(s => s.isWinner).length,
    avgPoints: (storicoSchedine.reduce((acc, s) => acc + s.totalPoints, 0) / storicoSchedine.length).toFixed(1),
    avgCorrect: (storicoSchedine.reduce((acc, s) => acc + s.correctPredictions, 0) / storicoSchedine.length).toFixed(1),
  };

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-primary-400 text-sm font-bold uppercase tracking-wider mb-1">
                <Calendar size={16} />
                Archivio Giocate
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-black uppercase italic tracking-tight text-white">
                Storico <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Schedine</span>
              </h1>
            </div>
          </div>
          <p className="text-slate-400 font-medium">Tutte le tue schedine della stagione 2025-2026</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="glass-card p-4 text-center border-t-2 border-primary-500">
            <p className="text-3xl font-mono font-bold text-white">{totalStats.totalSchedine}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Schedine</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-yellow-500">
            <p className="text-3xl font-mono font-bold text-yellow-400">{totalStats.wins}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vittorie</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-accent-500">
            <p className="text-3xl font-mono font-bold text-accent-400">{totalStats.avgPoints}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Media Punti</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-green-500">
            <p className="text-3xl font-mono font-bold text-green-400">{totalStats.avgCorrect}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Media Corretti</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6 p-1 bg-surface/50 rounded-xl border border-white/5 backdrop-blur-sm w-fit">
          <div className="pl-3 text-slate-500">
            <Filter size={16} />
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-1">
            {(['tutti', 'vinte', 'perse'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                  filter === f
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Schedine List */}
        <div className="space-y-4">
          {filteredSchedine.map((schedina) => {
            const isExpanded = expandedMatchday === schedina.matchday;
            
            return (
              <div key={schedina.matchday} className="glass-card overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
                {/* Header */}
                <div 
                  className={cn(
                    'p-4 sm:p-5 cursor-pointer transition-colors',
                    schedina.isWinner ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : 'hover:bg-white/5'
                  )}
                  onClick={() => setExpandedMatchday(isExpanded ? null : schedina.matchday)}
                >
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold border',
                      schedina.isWinner 
                        ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                        : 'bg-surface border-white/10 text-slate-400'
                    )}>
                      <span className="text-[10px] uppercase font-normal opacity-70">G</span>
                      <span className="text-xl leading-none">{schedina.matchday}</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-display font-bold text-lg uppercase italic tracking-wide text-white">
                          Giornata {schedina.matchday}
                        </span>
                        {schedina.isWinner && (
                          <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                            <Trophy size={10} />
                            Vincitore
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <Calendar size={14} />
                        {schedina.date}
                      </p>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="font-mono font-bold text-2xl text-white">{schedina.totalPoints} <span className="text-sm text-slate-500">pt</span></p>
                      <p className="text-xs text-slate-500">{schedina.correctPredictions}/10 corretti</p>
                    </div>

                    <ChevronDown 
                      size={20} 
                      className={cn(
                        'text-slate-500 transition-transform duration-300',
                        isExpanded && 'rotate-180 text-primary-400'
                      )}
                    />
                  </div>

                  {/* Mobile Stats */}
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5 sm:hidden">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Punti</p>
                      <p className="font-mono font-bold text-white">{schedina.totalPoints}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Corretti</p>
                      <p className="font-mono font-bold text-white">{schedina.correctPredictions}/10</p>
                    </div>
                    {(schedina.bonusPoints > 0 || schedina.penaltyPoints !== 0) && (
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Bonus</p>
                        <p className={cn(
                          "font-mono font-bold",
                          schedina.bonusPoints > 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {schedina.bonusPoints > 0 ? `+${schedina.bonusPoints}` : schedina.penaltyPoints}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded predictions */}
                <div className={cn(
                  'overflow-hidden transition-all duration-300 bg-black/20',
                  isExpanded && schedina.predictions.length > 0 ? 'max-h-[800px]' : 'max-h-0'
                )}>
                  <div className="border-t border-white/10">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <div className="col-span-6 sm:col-span-5">Partita</div>
                      <div className="col-span-2 text-center">Tuo</div>
                      <div className="col-span-2 text-center">Esito</div>
                      <div className="col-span-2 text-right">Quota</div>
                    </div>
                    <div className="divide-y divide-white/5">
                      {schedina.predictions.map((pred, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/5 transition-colors">
                          <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                            <div className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center shrink-0 border',
                              pred.correct 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            )}>
                              {pred.correct 
                                ? <CheckCircle2 size={12} />
                                : <XCircle size={12} />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {pred.home} <span className="text-slate-500 text-xs">vs</span> {pred.away}
                              </p>
                            </div>
                          </div>

                          <div className="col-span-2 text-center">
                            <span className={cn(
                              'font-bold font-mono',
                              pred.correct ? 'text-green-400' : 'text-red-400'
                            )}>{pred.prediction}</span>
                          </div>
                          
                          <div className="col-span-2 text-center">
                            <span className="font-bold font-mono text-white">{pred.result}</span>
                          </div>
                          
                          <div className="col-span-2 text-right">
                            <span className={cn(
                              'font-bold font-mono',
                              pred.correct ? 'text-primary-400' : 'text-slate-600'
                            )}>{pred.odds.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* No details message */}
                {isExpanded && schedina.predictions.length === 0 && (
                  <div className="border-t border-white/10 p-4 text-center text-white/50 text-sm">
                    Dettagli non disponibili per questa giornata
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredSchedine.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Calendar size={48} className="text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Nessuna schedina trovata con questo filtro</p>
          </div>
        )}
      </div>
    </div>
  );
}
