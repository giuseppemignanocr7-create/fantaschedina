// ============================================
// FANTA SCHEDINA - CONFERMA AZIONI DISTRUTTIVE
// Annullare una schedina, azzerarla, lasciare o eliminare una lega: prima
// bastava un tocco, anche per sbaglio. Ora si chiede conferma.
// ============================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ConfermaOpzioni {
  titolo: string;
  messaggio?: ReactNode;
  /** Testo del pulsante che conferma, es. "Ritira schedina". */
  conferma?: string;
  annulla?: string;
  /** Azione che toglie qualcosa: pulsante rosso. */
  pericolo?: boolean;
}

interface ConfirmDialogProps extends ConfermaOpzioni {
  onConferma: () => void;
  onAnnulla: () => void;
}

export function ConfirmDialog({
  titolo,
  messaggio,
  conferma = 'Conferma',
  annulla = 'Annulla',
  pericolo = false,
  onConferma,
  onAnnulla,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnnulla();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnnulla]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onAnnulla} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conferma-titolo"
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 animate-slide-up"
      >
        <h2 id="conferma-titolo" className="font-black text-base text-slate-900 mb-2">
          {titolo}
        </h2>
        {messaggio && <div className="text-sm text-slate-600 mb-4">{messaggio}</div>}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onAnnulla}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
          >
            {annulla}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConferma}
            className={cn(
              'min-h-[44px] px-4 rounded-xl text-sm font-black text-white',
              pericolo ? 'bg-red-600 hover:bg-red-500' : 'bg-primary-600 hover:bg-primary-500'
            )}
          >
            {conferma}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `const [dialogo, chiedi] = useConferma()`: `await chiedi({...})` risponde
 * true/false, e `dialogo` va messo nel JSX della pagina.
 */
export function useConferma(): [ReactNode, (o: ConfermaOpzioni) => Promise<boolean>] {
  const [richiesta, setRichiesta] = useState<{
    opzioni: ConfermaOpzioni;
    risolvi: (ok: boolean) => void;
  } | null>(null);

  const chiedi = useCallback(
    (opzioni: ConfermaOpzioni) =>
      new Promise<boolean>(risolvi => {
        setRichiesta(prima => {
          prima?.risolvi(false);
          return { opzioni, risolvi };
        });
      }),
    []
  );

  const chiudi = useCallback(
    (ok: boolean) => {
      richiesta?.risolvi(ok);
      setRichiesta(null);
    },
    [richiesta]
  );
  const onConferma = useCallback(() => chiudi(true), [chiudi]);
  const onAnnulla = useCallback(() => chiudi(false), [chiudi]);

  const dialogo = richiesta ? (
    <ConfirmDialog {...richiesta.opzioni} onConferma={onConferma} onAnnulla={onAnnulla} />
  ) : null;
  return [dialogo, chiedi];
}
