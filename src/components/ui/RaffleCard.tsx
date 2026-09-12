import { useEffect, useState } from 'react';
import { Loader2, Ticket } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { RAFFLE } from '@/lib/economy';
import {
  compraBiglietti,
  leggiEstrazione,
  leggiMieiBiglietti,
  leggiUltimaEstrazione,
  type RaffleDoc,
} from '@/lib/raffle';

interface Props {
  giornata: number | null;
}

/**
 * Estrazione della giornata: il pozzo dei gettoni. Ogni biglietto costa
 * RAFFLE.ticketCost e il premio va a sorte fra i partecipanti quando la
 * giornata viene valutata.
 */
export function RaffleCard({ giornata }: Props) {
  const { user, profile, refreshProfile } = useAuthContext();
  const [estrazione, setEstrazione] = useState<RaffleDoc | null>(null);
  const [miei, setMiei] = useState(0);
  const [ultima, setUltima] = useState<RaffleDoc | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [e, u, m] = await Promise.all([
          giornata != null ? leggiEstrazione(giornata) : Promise.resolve(null),
          leggiUltimaEstrazione(),
          giornata != null && user ? leggiMieiBiglietti(giornata, user.uid) : Promise.resolve(0),
        ]);
        if (!vivo) return;
        setEstrazione(e);
        setUltima(u);
        setMiei(m);
      } finally {
        if (vivo) setCaricamento(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [giornata, user]);

  const compra = async (n: number) => {
    setBusy(true);
    setEsito(null);
    const r = await compraBiglietti(n);
    if (r.ok) {
      setMiei(r.count);
      setEstrazione(prev =>
        prev
          ? { ...prev, totalTickets: r.totalTickets }
          : { matchday: giornata ?? 0, prize: { label: 'Cappellino', emoji: '🧢' }, totalTickets: r.totalTickets, participants: 1, status: 'open' }
      );
      setEsito(`Fatto: hai ${r.count} bigliett${r.count === 1 ? 'o' : 'i'}.`);
      void refreshProfile();
    } else {
      setEsito(r.motivo);
    }
    setBusy(false);
  };

  const premio = estrazione?.prize ?? { label: 'Cappellino', emoji: '🧢' };
  const totale = estrazione?.totalTickets ?? 0;
  const saldo = profile?.coins ?? 0;
  const spazio = Math.max(0, RAFFLE.maxTicketsPerUser - miei);
  const probabilita = totale > 0 ? Math.round((miei / totale) * 100) : 0;
  const chiusa = estrazione?.status === 'drawn';

  return (
    <div className="glass-card p-4 space-y-3 animate-slide-up">
      <div className="flex items-center gap-2">
        <Ticket size={18} className="text-primary-700" />
        <p className="font-black text-sm text-slate-900">Estrazione della giornata</p>
      </div>

      {caricamento ? (
        <div className="flex justify-center py-3">
          <Loader2 size={18} className="text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-primary-500/10 border border-primary-500/25 px-3 py-2.5">
            <span className="text-2xl">{premio.emoji ?? '🎁'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">In palio: {premio.label}</p>
              <p className="text-[11px] text-slate-500">
                {chiusa
                  ? `Vinto da ${estrazione?.winnerUsername ?? 'un giocatore'}`
                  : `Va a sorte fra chi ha biglietti quando la giornata viene valutata. ${totale} bigliett${totale === 1 ? 'o' : 'i'} nell’urna.`}
              </p>
            </div>
          </div>

          {!chiusa && giornata != null && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  I tuoi biglietti: <b className="text-slate-900">{miei}</b>
                  {miei > 0 && ` · ${probabilita}% di vincere`}
                </span>
                <span className="text-slate-500">
                  {RAFFLE.ticketCost} 🪙 l&apos;uno
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 5].map(n => {
                  const acquistabili = Math.min(n, spazio);
                  const costo = acquistabili * RAFFLE.ticketCost;
                  const disabilitato = busy || acquistabili === 0 || saldo < costo;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => compra(acquistabili)}
                      disabled={disabilitato}
                      className="flex-1 btn-green py-2.5 text-xs disabled:opacity-50"
                    >
                      {busy ? '…' : `+${acquistabili || n} · ${costo || n * RAFFLE.ticketCost} 🪙`}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500">
                {spazio === 0
                  ? `Hai raggiunto il massimo di ${RAFFLE.maxTicketsPerUser} biglietti per giornata.`
                  : saldo < RAFFLE.ticketCost
                  ? 'Ti servono altri gettoni: quiz e ruota sono gratis ogni giorno.'
                  : `Massimo ${RAFFLE.maxTicketsPerUser} biglietti a testa. Hai ${saldo} 🪙.`}
              </p>
            </>
          )}
          {esito && <p className="text-xs font-medium text-slate-700">{esito}</p>}

          {ultima && ultima.matchday !== giornata && (
            <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-2">
              Giornata {ultima.matchday}: {ultima.prize.emoji ?? ''} {ultima.prize.label} vinto da{' '}
              <b className="text-slate-900">{ultima.winnerUsername ?? '—'}</b> su {ultima.totalTickets} biglietti.
            </p>
          )}
        </>
      )}
    </div>
  );
}
