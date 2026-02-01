import { Trophy, TrendingUp, Zap, Gift } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface WinSimulatorProps {
  totalPoints: number;
  weeklyPool: number;
  finalPool: number;
  currentRank: number;
  participantCount: number;
  className?: string;
}

export function WinSimulator({ 
  totalPoints, 
  weeklyPool, 
  finalPool, 
  currentRank, 
  participantCount,
  className 
}: WinSimulatorProps) {
  // Calcola vincite potenziali
  const weeklyWinnerPrize = weeklyPool * 0.40;
  const weeklySharePrize = (weeklyPool * 0.40) / participantCount;
  
  // Premi finali stimati
  const finalFirst = finalPool * 0.50;
  const finalSecond = finalPool * 0.30;
  const finalThird = finalPool * 0.20;

  // Stima posizione finale basata su punti attuali
  const estimatedFinalRank = currentRank;
  const couldWinWeekly = totalPoints > 0;

  return (
    <div className={cn('glass-card overflow-hidden border-t-4 border-t-yellow-500', className)}>
      <div className="bg-surface px-4 py-3 border-b border-white/5">
        <h3 className="font-bold flex items-center gap-2 text-white uppercase tracking-wide text-sm">
          <Trophy size={16} className="text-yellow-400" />
          Simulatore Vincite
        </h3>
      </div>
      
      <div className="p-4 space-y-4 bg-surface/50">
        {/* Vincita Settimanale */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Zap size={12} />
            Potenziale Settimanale
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
              <p className="text-[10px] text-yellow-500 font-bold uppercase">1° Posto</p>
              <p className="text-lg font-mono font-bold text-white">{formatCurrency(weeklyWinnerPrize)}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Quota</p>
              <p className="text-lg font-mono font-bold text-white">{formatCurrency(weeklySharePrize)}</p>
            </div>
          </div>
          {couldWinWeekly && (
            <div className="flex items-center justify-between bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">
              <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                <TrendingUp size={12} />
                Totale Stimato
              </span>
              <span className="font-mono font-bold text-green-400">
                {formatCurrency(weeklyWinnerPrize + weeklySharePrize)}
              </span>
            </div>
          )}
        </div>

        {/* Vincita Finale */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Gift size={12} />
            Premi Stagionali
          </div>
          <div className="space-y-1.5">
            <div className={cn(
              'flex items-center justify-between p-2 rounded-lg border transition-colors',
              estimatedFinalRank === 1 
                ? 'bg-yellow-500/10 border-yellow-500/20' 
                : 'bg-white/5 border-transparent'
            )}>
              <div className="flex items-center gap-2">
                <span className="text-base">🥇</span>
                <span className="text-xs font-medium text-slate-300">1° Classificato</span>
              </div>
              <span className={cn('font-mono font-bold text-sm', estimatedFinalRank === 1 ? 'text-yellow-400' : 'text-slate-400')}>
                {formatCurrency(finalFirst)}
              </span>
            </div>
            <div className={cn(
              'flex items-center justify-between p-2 rounded-lg border transition-colors',
              estimatedFinalRank === 2 
                ? 'bg-slate-400/10 border-slate-400/20' 
                : 'bg-white/5 border-transparent'
            )}>
              <div className="flex items-center gap-2">
                <span className="text-base">🥈</span>
                <span className="text-xs font-medium text-slate-300">2° Classificato</span>
              </div>
              <span className={cn('font-mono font-bold text-sm', estimatedFinalRank === 2 ? 'text-slate-300' : 'text-slate-400')}>
                {formatCurrency(finalSecond)}
              </span>
            </div>
            <div className={cn(
              'flex items-center justify-between p-2 rounded-lg border transition-colors',
              estimatedFinalRank === 3 
                ? 'bg-orange-500/10 border-orange-500/20' 
                : 'bg-white/5 border-transparent'
            )}>
              <div className="flex items-center gap-2">
                <span className="text-base">🥉</span>
                <span className="text-xs font-medium text-slate-300">3° Classificato</span>
              </div>
              <span className={cn('font-mono font-bold text-sm', estimatedFinalRank === 3 ? 'text-orange-400' : 'text-slate-400')}>
                {formatCurrency(finalThird)}
              </span>
            </div>
          </div>
        </div>

        {/* Posizione attuale */}
        <div className="pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium uppercase tracking-wider">Classifica Attuale</span>
            <span className={cn(
              'font-mono font-bold px-2 py-0.5 rounded text-sm',
              currentRank <= 3 ? 'bg-primary-500/20 text-primary-400' : 'bg-white/10 text-slate-300'
            )}>
              #{currentRank} <span className="text-[10px] text-slate-500 font-sans font-normal ml-1">/ {participantCount}</span>
            </span>
          </div>
          {currentRank <= 3 && (
            <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1 font-medium bg-green-500/5 p-1.5 rounded border border-green-500/10">
              <TrendingUp size={10} />
              Sei in zona premio! Mantieni la posizione! 🔥
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
