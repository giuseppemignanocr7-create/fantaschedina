// ============================================
// FANTA SCHEDINA - POWER-UP SELECTOR
// Selezione power-up da allegare alla schedina (costo in gettoni).
// L'addebito e l'applicazione avvengono server-side al submit.
// ============================================

import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POWERUPS, type PowerUpSelection } from '@/lib/economy';
import type { Match } from '@/types';

interface PowerUpSelectorProps {
  coins: number;
  selection: PowerUpSelection;
  onChange: (selection: PowerUpSelection) => void;
  matches: Match[];
  predictions: { matchId: string }[];
  disabled?: boolean;
}

export function PowerUpSelector({
  coins,
  selection,
  onChange,
  matches,
  predictions,
  disabled,
}: PowerUpSelectorProps) {
  const totalCost =
    (selection.jolly ? POWERUPS.jolly.cost : 0) +
    (selection.shield ? POWERUPS.shield.cost : 0) +
    (selection.insurance ? POWERUPS.insurance.cost : 0);

  const canAfford = (cost: number, active: boolean) =>
    active || coins - totalCost >= cost;

  const toggle = (id: 'shield' | 'insurance') => {
    if (disabled) return;
    const active = !!selection[id];
    if (!active && !canAfford(POWERUPS[id].cost, false)) return;
    onChange({ ...selection, [id]: active ? undefined : true });
  };

  const toggleJolly = () => {
    if (disabled) return;
    if (selection.jolly) {
      onChange({ ...selection, jolly: undefined });
      return;
    }
    if (!canAfford(POWERUPS.jolly.cost, false)) return;
    // Default: primo pronostico selezionato
    const first = predictions[0]?.matchId;
    if (first) onChange({ ...selection, jolly: first });
  };

  const setJollyMatch = (matchId: string) => {
    if (disabled) return;
    onChange({ ...selection, jolly: matchId });
  };

  return (
    <div className="border-t border-white/10 pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-white">Power-up</p>
        <div className="flex items-center gap-1 text-xs">
          <Coins size={12} className="text-yellow-400" />
          <span className="font-bold text-yellow-400">{coins - totalCost}</span>
          {totalCost > 0 && (
            <span className="text-white/40">(-{totalCost})</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Jolly */}
        <div
          className={cn(
            'p-2 rounded-lg border transition-all',
            selection.jolly
              ? 'bg-primary-500/10 border-primary-500/40'
              : 'bg-white/5 border-white/10',
            !selection.jolly && !canAfford(POWERUPS.jolly.cost, false) && 'opacity-40'
          )}
        >
          <button
            onClick={toggleJolly}
            disabled={disabled}
            className="w-full flex items-center gap-2 text-left"
          >
            <span className="text-lg">{POWERUPS.jolly.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">{POWERUPS.jolly.name}</p>
              <p className="text-[10px] text-white/40 leading-tight">
                {POWERUPS.jolly.description}
              </p>
            </div>
            <span className="text-[10px] font-black text-yellow-400 flex-shrink-0">
              {POWERUPS.jolly.cost} 🪙
            </span>
          </button>
          {selection.jolly && (
            <select
              value={selection.jolly}
              onChange={e => setJollyMatch(e.target.value)}
              disabled={disabled}
              className="mt-2 w-full bg-surface border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              {predictions.map(p => {
                const m = matches.find(x => x.id === p.matchId);
                return (
                  <option key={p.matchId} value={p.matchId}>
                    {m ? `${m.homeTeam.shortName} - ${m.awayTeam.shortName}` : p.matchId}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Shield + Insurance */}
        {(['shield', 'insurance'] as const).map(id => {
          const pu = POWERUPS[id];
          const active = !!selection[id];
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={disabled}
              className={cn(
                'w-full p-2 rounded-lg border flex items-center gap-2 text-left transition-all',
                active
                  ? 'bg-primary-500/10 border-primary-500/40'
                  : 'bg-white/5 border-white/10',
                !active && !canAfford(pu.cost, false) && 'opacity-40'
              )}
            >
              <span className="text-lg">{pu.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{pu.name}</p>
                <p className="text-[10px] text-white/40 leading-tight">{pu.description}</p>
              </div>
              <span className="text-[10px] font-black text-yellow-400 flex-shrink-0">
                {pu.cost} 🪙
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-white/30 mt-2">
        Guadagna gettoni con i minigiochi e le missioni 🎮
      </p>
    </div>
  );
}
