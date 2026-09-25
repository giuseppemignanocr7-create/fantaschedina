// ============================================
// CONFERMA INVITO — link `/leghe?invito=CODICE`
//
// Un link non fa entrare da solo: chi lo apre vede in quale lega sta per
// entrare, quanti ne fanno gia' parte e che il creatore vedra' le sue
// giocate. Poi decide lui.
// ============================================

import { Eye, Loader2, Users } from 'lucide-react';
import { AVVISO_GIOCATE_VISIBILI, type AnteprimaInvito } from '@/lib/leagues';

interface Props {
  codice: string;
  anteprima: AnteprimaInvito | null;
  busy: boolean;
  onConferma: () => void;
  onAnnulla: () => void;
}

export function ConfermaInvito({ codice, anteprima, busy, onConferma, onAnnulla }: Props) {
  if (!anteprima) {
    return (
      <div className="glass-card p-4 mb-4 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-primary-700 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-slate-900">Controllo l'invito…</p>
          <p className="text-xs text-slate-500">Codice {codice}</p>
        </div>
      </div>
    );
  }

  const piena = anteprima.maxMembers > 0 && anteprima.memberCount >= anteprima.maxMembers;

  return (
    <div className="glass-card p-4 mb-4 space-y-3 animate-pop-in" role="dialog" aria-labelledby="invito-titolo">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Invito a una lega</p>
        <p id="invito-titolo" className="text-lg font-black text-slate-900 break-words">
          {anteprima.name}
        </p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <Users size={12} />
          {anteprima.memberCount}/{anteprima.maxMembers} membri
          {anteprima.ownerName && <> · creata da {anteprima.ownerName}</>}
        </p>
      </div>

      <p className="text-xs text-slate-700 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-start gap-2">
        <Eye size={14} className="flex-shrink-0 mt-0.5 text-yellow-700" />
        <span>{AVVISO_GIOCATE_VISIBILI}</span>
      </p>

      {piena && !anteprima.giaMembro && (
        <p className="text-xs font-bold text-red-600">La lega è al completo.</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAnnulla}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-black text-xs uppercase disabled:opacity-40"
        >
          No, grazie
        </button>
        <button
          onClick={onConferma}
          disabled={busy || (piena && !anteprima.giaMembro)}
          className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-night font-black text-xs uppercase disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {anteprima.giaMembro ? 'Apri la lega' : 'Entra nella lega'}
        </button>
      </div>
    </div>
  );
}
