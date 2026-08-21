// ============================================
// SFIDE 1VS1 — cinque rigori contro un altro giocatore
//
// L'avversario non gioca in diretta: il server simula i suoi tiri con una
// qualità legata alle sue statistiche reali (pronostici esatti su giornate
// giocate). Esiti, premio e cooldown settimanale sono decisi da `playMinigame`
// lato server: qui si sceglie soltanto dove e come tirare.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Swords, Loader2, Trophy, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSilentProfileRefresh } from '@/hooks/useSilentProfileRefresh';
import { getRankings } from '@/lib/db';
import {
  startSfida,
  playSfida,
  callableErrorMessage,
  type SfidaPlayResponse,
  type PenaltyShotInput,
} from '@/lib/gameApi';
import { PenaltyStadium, type PenaltyStadiumShot } from '@/components/games/PenaltyStadium';
import { PenaltyZoneGrid, PenaltyPowerMeter } from '@/components/games/PenaltyAimer';
import { COINS } from '@/lib/economy';
import type { PenaltyZone } from '@/lib/penalty';
import { vibrate, burstConfetti } from '@/lib/juice';

const TIRI = 5;
/** Durata dell'animazione di ogni tiro nella rivelazione finale. */
const RIVELAZIONE_MS = 1500;

type Fase = 'scelta' | 'tiri' | 'rivelazione' | 'risultato';

interface Avversario {
  uid: string;
  username: string;
  totalPoints: number;
}

export function SfidePage() {
  const { profile } = useAuthContext();
  const toast = useToast();
  const refreshProfile = useSilentProfileRefresh('SfidePage');

  const [fase, setFase] = useState<Fase>('scelta');
  const [avversari, setAvversari] = useState<Avversario[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [sfidato, setSfidato] = useState<Avversario | null>(null);
  const [avvio, setAvvio] = useState(false);

  const [tiri, setTiri] = useState<PenaltyShotInput[]>([]);
  const [zonaScelta, setZonaScelta] = useState<PenaltyZone | null>(null);
  const [invio, setInvio] = useState(false);

  const [esito, setEsito] = useState<SfidaPlayResponse | null>(null);
  const [tiroMostrato, setTiroMostrato] = useState(0);

  useEffect(() => {
    let annullato = false;
    getRankings()
      .then(righe => {
        if (annullato) return;
        setAvversari(
          righe
            .filter(r => r.participantId !== profile?.id)
            .map(r => ({
              uid: r.participantId,
              username: r.username,
              totalPoints: r.totalPoints,
            }))
        );
      })
      .catch(e => console.warn('[Sfide] avversari:', e))
      .finally(() => {
        if (!annullato) setCaricamento(false);
      });
    return () => {
      annullato = true;
    };
  }, [profile?.id]);

  /** Rivelazione: un tiro alla volta, poi il risultato finale. */
  useEffect(() => {
    if (fase !== 'rivelazione' || !esito) return;
    if (tiroMostrato >= TIRI) {
      const t = setTimeout(() => {
        setFase('risultato');
        if (esito.won) burstConfetti();
      }, RIVELAZIONE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTiroMostrato(n => n + 1), RIVELAZIONE_MS);
    return () => clearTimeout(t);
  }, [fase, esito, tiroMostrato]);

  const iniziaSfida = async (avversario: Avversario) => {
    setAvvio(true);
    try {
      await startSfida(avversario.uid);
      setSfidato(avversario);
      setTiri([]);
      setZonaScelta(null);
      setFase('tiri');
    } catch (e) {
      toast.error(callableErrorMessage(e));
    } finally {
      setAvvio(false);
    }
  };

  const confermaTiro = async (power: number) => {
    if (!zonaScelta || !sfidato) return;
    const nuovi = [...tiri, { zone: zonaScelta, power }];
    setZonaScelta(null);
    setTiri(nuovi);
    vibrate(30);
    if (nuovi.length < TIRI) return;

    // Cinque tiri completi: li risolve il server, tutti insieme.
    setInvio(true);
    try {
      const risultato = await playSfida(sfidato.uid, nuovi);
      setEsito(risultato);
      setTiroMostrato(0);
      setFase('rivelazione');
      refreshProfile();
    } catch (e) {
      toast.error(callableErrorMessage(e));
      setTiri([]);
      setFase('scelta');
    } finally {
      setInvio(false);
    }
  };

  const ricomincia = () => {
    setEsito(null);
    setSfidato(null);
    setTiri([]);
    setZonaScelta(null);
    setTiroMostrato(0);
    setFase('scelta');
  };

  const tiroCorrente = useMemo(() => {
    if (!esito) return null;
    const indice = Math.min(tiroMostrato, TIRI - 1);
    const mio = esito.myResults[indice];
    return mio ? ({ shot: mio.shot, keeper: mio.keeper, goal: mio.goal } as PenaltyStadiumShot) : null;
  }, [esito, tiroMostrato]);

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <Link
        to="/minigiochi"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Minigiochi
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <Swords className="text-teal-400" size={24} />
        <h1 className="font-display font-black text-2xl text-white uppercase">Sfide 1vs1</h1>
      </div>
      <p className="text-white/50 text-sm mb-6">
        Cinque rigori contro un altro giocatore. Vinci fino a {COINS.sfidaMaxReward} gettoni; puoi
        sfidare lo stesso avversario una volta ogni {COINS.sfidaCooldownDays} giorni.
      </p>

      {fase === 'scelta' && (
        <div className="glass-card p-4">
          <h2 className="font-bold text-white mb-3">Scegli chi sfidare</h2>
          {caricamento ? (
            <div className="flex items-center gap-2 text-white/50 py-6 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carico i giocatori...
            </div>
          ) : avversari.length === 0 ? (
            <p className="text-white/50 text-sm py-6 text-center">
              Non c'è ancora nessun altro giocatore da sfidare.
            </p>
          ) : (
            <ul className="space-y-2">
              {avversari.map(a => (
                <li
                  key={a.uid}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{a.username}</p>
                    <p className="text-xs text-white/40">{a.totalPoints.toFixed(1)} pt</p>
                  </div>
                  <button
                    onClick={() => iniziaSfida(a)}
                    disabled={avvio}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold hover:bg-teal-500/30 transition-colors disabled:opacity-50"
                  >
                    <Swords size={14} />
                    Sfida
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fase === 'tiri' && sfidato && (
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-sm">
              Contro <span className="font-bold text-white">{sfidato.username}</span>
            </p>
            <p className="font-mono text-sm text-teal-300">
              Tiro {Math.min(tiri.length + 1, TIRI)} / {TIRI}
            </p>
          </div>

          <PenaltyStadium revealShot={null} revealKey={tiri.length}>
            {!zonaScelta && <PenaltyZoneGrid disabled={invio} onPick={setZonaScelta} />}
          </PenaltyStadium>

          {zonaScelta ? (
            <PenaltyPowerMeter
              zone={zonaScelta}
              onConfirm={confermaTiro}
              onCancel={() => setZonaScelta(null)}
            />
          ) : (
            <p className="text-center text-white/50 text-sm">
              Tocca la porta per scegliere dove tirare.
            </p>
          )}

          <div className="flex justify-center gap-2">
            {Array.from({ length: TIRI }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  i < tiri.length ? 'bg-teal-400' : 'bg-white/15'
                )}
              />
            ))}
          </div>

          {invio && (
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Il portiere si prepara...
            </div>
          )}
        </div>
      )}

      {fase === 'rivelazione' && esito && (
        <div className="glass-card p-4 space-y-4">
          <p className="text-center text-white/60 text-sm">
            Tiro {Math.min(tiroMostrato + 1, TIRI)} di {TIRI}
          </p>
          <PenaltyStadium revealShot={tiroCorrente} revealKey={tiroMostrato} />
          <div className="flex justify-center gap-2">
            {esito.myResults.slice(0, tiroMostrato + 1).map((r, i) => (
              <span key={i} className="text-xl">
                {r.goal ? '⚽' : '🧤'}
              </span>
            ))}
          </div>
        </div>
      )}

      {fase === 'risultato' && esito && sfidato && (
        <div className="glass-card p-6 text-center space-y-5">
          <div className="text-6xl">{esito.won ? '🏆' : esito.draw ? '🤝' : '😢'}</div>
          <h2 className="font-display font-black text-2xl text-white uppercase">
            {esito.won ? 'Hai vinto!' : esito.draw ? 'Pareggio!' : 'Hai perso!'}
          </h2>

          <div className="flex items-center justify-center gap-6">
            <div>
              <p className="text-xs text-white/40 uppercase">Tu</p>
              <p className="font-black text-4xl text-teal-400">{esito.myGoals}</p>
            </div>
            <span className="text-2xl text-white/30 font-black">-</span>
            <div>
              <p className="text-xs text-white/40 uppercase truncate max-w-[120px]">
                {sfidato.username}
              </p>
              <p className="font-black text-4xl text-red-400">{esito.oppGoals}</p>
            </div>
          </div>

          <div className="flex justify-center gap-6 text-sm">
            <div>
              <p className="text-white/40 text-xs mb-1">I tuoi tiri</p>
              <p>{esito.myResults.map(r => (r.goal ? '⚽' : '🧤')).join(' ')}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">I suoi</p>
              <p>{esito.oppResults.map(r => (r.goal ? '⚽' : '🧤')).join(' ')}</p>
            </div>
          </div>

          {esito.reward > 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
              <p className="text-yellow-200/60 text-xs uppercase tracking-widest mb-1">Premio</p>
              <p className="font-black text-3xl text-yellow-400 flex items-center justify-center gap-2">
                <Coins size={24} />+{esito.reward}
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Nessun premio questa volta.</p>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={ricomincia}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold text-sm hover:bg-teal-500/30 transition-colors"
            >
              <Swords size={16} />
              Sfida un altro
            </button>
            <Link
              to="/minigiochi"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-colors"
            >
              <Trophy size={16} />
              Altri minigiochi
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
