import { useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { attivaPush, disattivaPush, inviaNotificaDiProva, statoPush, type PushStatus } from '@/lib/push';
import { cn } from '@/lib/utils';
import { NotifPrefs } from '@/components/ui/NotifPrefs';

function usePush() {
  const { user } = useAuthContext();
  const [stato, setStato] = useState<PushStatus>(() => statoPush(user?.uid));
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const attiva = async () => {
    setBusy(true);
    setErrore(null);
    const esito = await attivaPush();
    if (!esito.ok) setErrore(esito.motivo);
    setStato(statoPush(user?.uid));
    setBusy(false);
  };
  const disattiva = async () => {
    setBusy(true);
    await disattivaPush();
    setStato(statoPush(user?.uid));
    setBusy(false);
  };
  return { stato, busy, errore, attiva, disattiva };
}

/** Card completa per la pagina Account. */
export function PushCard() {
  const { stato, busy, errore, attiva, disattiva } = usePush();
  if (stato === 'unsupported') return null;

  const acceso = stato === 'on';
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-primary-700" />
        <p className="font-black text-sm text-slate-900">Notifiche</p>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        Ti avvisiamo quando la schedina sta per chiudere, al calcio d&apos;inizio e quando la
        giornata viene valutata. Niente altro.
      </p>
      <button
        type="button"
        onClick={acceso ? disattiva : attiva}
        disabled={busy || stato === 'blocked'}
        aria-pressed={acceso}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-60',
          acceso ? 'bg-primary-500/15 border border-primary-500/40' : 'bg-slate-100 hover:bg-slate-200'
        )}
      >
        {busy ? (
          <Loader2 size={17} className="text-slate-500 animate-spin flex-shrink-0" />
        ) : acceso ? (
          <BellRing size={17} className="text-primary-700 flex-shrink-0" />
        ) : (
          <BellOff size={17} className="text-slate-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-slate-900">
            {acceso ? 'Notifiche attive su questo dispositivo' : 'Attiva le notifiche'}
          </p>
          <p className="text-[10px] text-slate-500">
            {stato === 'blocked'
              ? 'Bloccate dal browser: riattivale dalle impostazioni del sito'
              : acceso
              ? 'Tocca per disattivarle'
              : 'Scadenza schedina, calcio d’inizio, giornata valutata'}
          </p>
        </div>
      </button>
      {acceso && <ProvaInvio />}
      {errore && <p className="text-xs text-red-600 font-medium">{errore}</p>}
      <NotifPrefs />
    </div>
  );
}

function ProvaInvio() {
  const [esito, setEsito] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invia = async () => {
    setBusy(true);
    setEsito(null);
    const r = await inviaNotificaDiProva();
    setEsito(
      r.ok
        ? r.consegnati > 0
          ? 'Inviata: dovrebbe comparire fra pochi secondi.'
          : 'Il server non ha trovato dispositivi validi: prova a disattivare e riattivare.'
        : r.motivo
    );
    setBusy(false);
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] text-slate-500">{esito ?? 'Vuoi verificare che arrivino?'}</p>
      <button
        type="button"
        onClick={invia}
        disabled={busy}
        className="text-[11px] font-bold text-primary-700 hover:text-primary-800 whitespace-nowrap disabled:opacity-60"
      >
        {busy ? 'Invio…' : 'Invia una prova'}
      </button>
    </div>
  );
}

const CHIAVE_CHIUSO = 'push:banner-chiuso';

/** Invito compatto in home: compare finche' l'utente non decide. */
export function PushBanner() {
  const { stato, busy, errore, attiva } = usePush();
  const [chiuso, setChiuso] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_CHIUSO) === '1';
    } catch {
      return false;
    }
  });
  if (chiuso || stato !== 'off') return null;

  const chiudi = () => {
    try {
      localStorage.setItem(CHIAVE_CHIUSO, '1');
    } catch {
      /* niente */
    }
    setChiuso(true);
  };

  return (
    <div className="glass-card p-3 flex items-center gap-3 animate-slide-up">
      <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center flex-shrink-0">
        <Bell size={18} className="text-primary-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 leading-tight">Non perdere la scadenza</p>
        <p className="text-[11px] text-slate-500 leading-snug">
          {errore ?? 'Un avviso prima che la schedina chiuda, al fischio d’inizio e a giornata valutata.'}
        </p>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={attiva}
          disabled={busy}
          className="btn-green text-[11px] px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {busy ? '…' : 'Attiva'}
        </button>
        <button type="button" onClick={chiudi} className="text-[10px] text-slate-500 hover:text-slate-900">
          Non ora
        </button>
      </div>
    </div>
  );
}
