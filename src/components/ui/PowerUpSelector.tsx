// ============================================
// FANTA SCHEDINA - POWER-UP SELECTOR
// Selezione power-up da allegare alla schedina (costo in gettoni).
// L'addebito e l'applicazione avvengono server-side al submit.
// ============================================

import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POWERUPS, type PowerUpSelection } from '@/lib/economy';
import { costoPowerup } from '@/lib/anteprimaPunti';
import type { Match } from '@/types';

interface PowerUpSelectorProps {
  coins: number;
  selection: PowerUpSelection;
  onChange: (selection: PowerUpSelection) => void;
  matches: Match[];
  predictions: { matchId: string }[];
  disabled?: boolean;
  /**
   * Gettoni gia' spesi per i power-up della schedina che si sta modificando:
   * al re-invio il server li rimborsa prima di addebitare i nuovi, quindi
   * vanno contati come disponibili. Senza, il costo si toglieva due volte.
   */
  credito?: number;
}

export function PowerUpSelector({
  coins,
  selection,
  onChange,
  matches,
  predictions,
  disabled,
  credito = 0,
}: PowerUpSelectorProps) {
  const totalCost = costoPowerup(selection);
  // Gettoni che restano dopo i power-up gia' scelti in questa selezione.
  const residui = coins + credito - totalCost;

  const mancano = (cost: number, active: boolean) => (active ? 0 : Math.max(0, cost - residui));

  const toggle = (id: 'shield' | 'insurance') => {
    if (disabled) return;
    const active = !!selection[id];
    if (!active && mancano(POWERUPS[id].cost, false) > 0) return;
    onChange({ ...selection, [id]: active ? undefined : true });
  };

  const toggleJolly = () => {
    if (disabled) return;
    if (selection.jolly) {
      onChange({ ...selection, jolly: undefined });
      return;
    }
    if (mancano(POWERUPS.jolly.cost, false) > 0) return;
    // Default: primo pronostico selezionato
    const first = predictions[0]?.matchId;
    if (first) onChange({ ...selection, jolly: first });
  };

  const setJollyMatch = (matchId: string) => {
    if (disabled) return;
    onChange({ ...selection, jolly: matchId });
  };

  const notaMancano = (n: number) =>
    n > 0 ? (
      <span className="block text-[10px] font-bold text-red-600 mt-0.5">
        Ti mancano {n} gettoni
      </span>
    ) : null;

  const mancanoJolly = mancano(POWERUPS.jolly.cost, !!selection.jolly);

  return (
    <div className="border-t border-slate-200 pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-slate-900">Power-up</p>
        <div className="flex items-center gap-1 text-xs" title="Gettoni che ti restano dopo l'invio">
          <Coins size={12} className="text-yellow-700" />
          <span className="font-bold text-yellow-700">{residui}</span>
          {totalCost > 0 && (
            <span className="text-slate-500">(-{totalCost})</span>
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
              : 'bg-slate-100 border-slate-200',
            mancanoJolly > 0 && 'opacity-60'
          )}
        >
          <button
            onClick={toggleJolly}
            disabled={disabled}
            aria-pressed={!!selection.jolly}
            className="w-full min-h-[44px] flex items-center gap-2 text-left"
          >
            <span className="text-lg">{POWERUPS.jolly.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">{POWERUPS.jolly.name}</p>
              <p className="text-[10px] text-slate-500 leading-tight">
                {POWERUPS.jolly.description}
              </p>
              {notaMancano(mancanoJolly)}
            </div>
            <span className="text-[10px] font-black text-yellow-700 flex-shrink-0">
              {POWERUPS.jolly.cost} 🪙
            </span>
          </button>
          {selection.jolly && (
            <select
              value={selection.jolly}
              onChange={e => setJollyMatch(e.target.value)}
              disabled={disabled}
              aria-label="Partita su cui usare il Jolly"
              className="mt-2 w-full min-h-[44px] bg-surface border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900"
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
          const n = mancano(pu.cost, active);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'w-full min-h-[44px] p-2 rounded-lg border flex items-center gap-2 text-left transition-all',
                active
                  ? 'bg-primary-500/10 border-primary-500/40'
                  : 'bg-slate-100 border-slate-200',
                n > 0 && 'opacity-60'
              )}
            >
              <span className="text-lg">{pu.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900">{pu.name}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{pu.description}</p>
                {notaMancano(n)}
              </div>
              <span className="text-[10px] font-black text-yellow-700 flex-shrink-0">
                {pu.cost} 🪙
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-600 mt-2">
        Guadagna gettoni con i minigiochi e le missioni 🎮
      </p>
    </div>
  );
}
