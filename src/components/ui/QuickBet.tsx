import { useState } from 'react';
import { Zap, Shuffle, TrendingDown, Copy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BetType, BetOutcome, Prediction, Match } from '@/types';
import type { MatchOdds } from '@/data/mockData';

interface QuickBetProps {
  matches: Match[];
  odds: Record<string, MatchOdds>;
  onApply: (predictions: Prediction[]) => void;
  disabled?: boolean;
  className?: string;
}

type QuickBetStrategy = 'favorites' | 'random' | 'value' | 'balanced';

export function QuickBet({ matches, odds, onApply, disabled, className }: QuickBetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const strategies: { key: QuickBetStrategy; label: string; icon: typeof Zap; desc: string }[] = [
    { key: 'favorites', label: 'Favoriti', icon: TrendingDown, desc: 'Quote più basse (1X2)' },
    { key: 'random', label: 'Casuale', icon: Shuffle, desc: 'Selezione casuale' },
    { key: 'value', label: 'Value Bet', icon: Sparkles, desc: 'Quote 2.00-3.00' },
    { key: 'balanced', label: 'Bilanciato', icon: Copy, desc: 'Mix di mercati' },
  ];

  const generatePredictions = (strategy: QuickBetStrategy): Prediction[] => {
    return matches.map((match) => {
      const matchOdds = odds[match.id];
      if (!matchOdds) {
        return {
          matchId: match.id,
          betType: 'esito' as BetType,
          outcome: '1' as BetOutcome,
          odds: 2.00,
        };
      }

      switch (strategy) {
        case 'favorites': {
          // Trova la quota più bassa in esito
          const esitoOdds = matchOdds.esito;
          const minKey = Object.entries(esitoOdds).reduce((a, b) => 
            b[1] < a[1] ? b : a
          );
          return {
            matchId: match.id,
            betType: 'esito' as BetType,
            outcome: minKey[0] as BetOutcome,
            odds: minKey[1],
          };
        }

        case 'random': {
          // Scegli mercato e outcome casuale
          const betTypes: BetType[] = ['esito', 'over_under', 'goal_nogoal', 'doppia_chance'];
          const randomBetType = betTypes[Math.floor(Math.random() * betTypes.length)];
          const typeOdds = matchOdds[randomBetType] as Record<string, number>;
          const keys = Object.keys(typeOdds);
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          return {
            matchId: match.id,
            betType: randomBetType,
            outcome: randomKey as BetOutcome,
            odds: typeOdds[randomKey],
          };
        }

        case 'value': {
          // Cerca quote tra 2.00 e 3.00
          const allOdds: { betType: BetType; outcome: string; odds: number }[] = [];
          
          Object.entries(matchOdds).forEach(([betType, typeOdds]) => {
            Object.entries(typeOdds as Record<string, number>).forEach(([outcome, odd]) => {
              if (odd >= 2.00 && odd <= 3.00) {
                allOdds.push({ betType: betType as BetType, outcome, odds: odd });
              }
            });
          });

          if (allOdds.length > 0) {
            const selected = allOdds[Math.floor(Math.random() * allOdds.length)];
            return {
              matchId: match.id,
              betType: selected.betType,
              outcome: selected.outcome as BetOutcome,
              odds: selected.odds,
            };
          }
          
          // Fallback a esito X
          return {
            matchId: match.id,
            betType: 'esito' as BetType,
            outcome: 'X' as BetOutcome,
            odds: matchOdds.esito['X'],
          };
        }

        case 'balanced': {
          // Alterna tra diversi mercati
          const index = matches.indexOf(match);
          const betTypes: BetType[] = ['esito', 'over_under', 'goal_nogoal', 'doppia_chance'];
          const betType = betTypes[index % betTypes.length];
          const typeOdds = matchOdds[betType] as Record<string, number>;
          const keys = Object.keys(typeOdds);
          // Prendi la prima opzione
          return {
            matchId: match.id,
            betType,
            outcome: keys[0] as BetOutcome,
            odds: typeOdds[keys[0]],
          };
        }

        default:
          return {
            matchId: match.id,
            betType: 'esito' as BetType,
            outcome: '1' as BetOutcome,
            odds: matchOdds.esito['1'],
          };
      }
    });
  };

  const handleApply = (strategy: QuickBetStrategy) => {
    const predictions = generatePredictions(strategy);
    onApply(predictions);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all shadow-lg',
          'bg-gradient-to-r from-accent-500 to-accent-600 text-white border border-accent-400/50',
          'hover:from-accent-400 hover:to-accent-500 hover:shadow-accent-500/20 hover:-translate-y-0.5',
          disabled && 'opacity-50 cursor-not-allowed grayscale'
        )}
      >
        <Zap size={16} className="text-white fill-white" />
        Giocata Rapida
      </button>

      {isOpen && !disabled && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-72 glass-card p-2 z-50 shadow-2xl border-t-2 border-t-accent-500 animate-slide-up bg-surface">
            <div className="px-3 py-2 bg-white/5 rounded-lg mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Compilazione Automatica</p>
              <Zap size={12} className="text-accent-400" />
            </div>
            <div className="space-y-1">
              {strategies.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => handleApply(s.key)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all group text-left border border-transparent hover:border-white/5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center group-hover:bg-primary-500/20 group-hover:border-primary-500/30 transition-colors">
                      <Icon size={18} className="text-primary-400 group-hover:text-primary-300" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white group-hover:text-primary-400 transition-colors">{s.label}</p>
                      <p className="text-[10px] text-slate-500">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
