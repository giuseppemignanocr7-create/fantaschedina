// ============================================
// SFIDE 1VS1 — cinque rigori contro un altro giocatore
//
// L'avversario non gioca in diretta: il server simula i suoi tiri con una
// qualità legata alle sue statistiche reali (pronostici esatti su giornate
// giocate). Esiti, premio e cooldown settimanale sono decisi da `playMinigame`
// lato server: qui si sceglie soltanto dove e come tirare, nell'arena.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Swords, Loader2, Trophy, Coins, Search } from 'lucide-react';
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
import { PenaltyArena, type ArenaReveal } from '@/components/games/PenaltyArena';
import { PenaltyPowerMeter } from '@/components/games/PenaltyAimer';
import { COINS } from '@/lib/economy';
import type { PenaltyZone } from '@/lib/penalty';
import { vibrate, burstConfetti } from '@/lib/juice';

const TIRI = 5;
/** Durata dell'animazione di ogni tiro nella rivelazione finale. */
const RIVELAZIONE_MS = 2300;

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
  const [filtro, setFiltro] = useState('');
  const [sfidato, setSfidato] = useState<Avversario | null>(null);
  const [avvio, setAvvio] = useState<string | null>(null);

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
            .map(r => ({ uid: r.participantId, username: r.username, totalPoints: r.totalPoints }))
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
      }, 600);
      return () => clearTimeout(t);
    }
    const corrente = esito.myResults[tiroMostrato];
    if (corrente?.goal) {
      const c = setTimeout(() => burstConfetti({ x: 0.5, y: 0.35 }), 640);
      const t = setTimeout(() => setTiroMostrato(n => n + 1), RIVELAZIONE_MS);
      return () => {
        clearTimeout(c);
        clearTimeout(t);
      };
    }
    const t = setTimeout(() => setTiroMostrato(n => n + 1), RIVELAZIONE_MS);
    return () => clearTimeout(t);
  }, [fase, esito, tiroMostrato]);

  const iniziaSfida = async (avversario: Avversario) => {
    setAvvio(avversario.uid);
    try {
      await startSfida(avversario.uid);
      setSfidato(avversario);
      setTiri([]);
      setZonaScelta(null);
      setFase('tiri');
    } catch (e) {
      toast.error(callableErrorMessage(e));
    } finally {
      setAvvio(null);
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

  const tiroCorrente = useMemo<ArenaReveal | null>(() => {
    if (!esito || tiroMostrato >= TIRI) return null;
    const mio = esito.myResults[tiroMostrato];
    return mio ? { shot: mio.shot, keeper: mio.keeper, outcome: mio.goal ? 'goal' : 'saved' } : null;
  }, [esito, tiroMostrato]);

  const avversariFiltrati = avversari.filter(a => a.username.toLowerCase().includes(filtro.trim().toLowerCase()));
  const inArena = fase === 'tiri' || fase === 'rivelazione';

  return (
    <div className="min-h-screen">
      {/* Fascia scura con l'arena quando si tira; testata chiara altrimenti */}
      {inArena ? (
        <div className="relative bg-night rounded-b-[28px] shadow-lg shadow-black/25">
          <div
            className="absolute inset-0 rounded-b-[28px] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse 70% 90% at 50% -30%, rgba(132,216,12,0.14) 0%, transparent 70%)' }}
          />
          <div className="relative max-w-md mx-auto px-4 pt-3 pb-4 space-y-3">
            <header className="flex items-center justify-between">
              <Link to="/minigiochi" className="p-2 -ml-2 text-white/70 hover:text-white transition-colors" aria-label="Torna ai minigiochi">
                <ArrowLeft size={22} />
              </Link>
              <div className="text-center">
                <p className="font-display font-black text-sm text-white tracking-[0.2em]">
                  {fase === 'tiri' ? `RIGORE ${Math.min(tiri.length + 1, TIRI)} / ${TIRI}` : `RIGORE ${Math.min(tiroMostrato + 1, TIRI)} / ${TIRI}`}
                </p>
                <p className="text-[10px] text-primary-400 uppercase tracking-widest font-bold truncate max-w-[180px]">
                  contro {sfidato?.username}
                </p>
              </div>
              <div className="w-8" />
            </header>

            {/* Pallini dei tiri */}
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: TIRI }, (_, i) => {
                const r = fase === 'rivelazione' && esito && i < tiroMostrato ? esito.myResults[i] : null;
                return (
                  <span
                    key={i}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-sm border',
                      r ? (r.goal ? 'bg-primary-500 border-primary-300' : 'bg-red-500/80 border-red-300') : i < tiri.length && fase === 'tiri' ? 'bg-white/20 border-white/40' : 'bg-white/5 border-white/15'
                    )}
                  >
                    {r ? (r.goal ? '⚽' : '🧤') : ''}
                  </span>
                );
              })}
            </div>

            <PenaltyArena
              reveal={fase === 'rivelazione' ? tiroCorrente : null}
              revealKey={fase === 'rivelazione' ? tiroMostrato : tiri.length}
              picking={fase === 'tiri' ? 'shoot' : null}
              picked={zonaScelta}
              disabled={invio}
              onPick={z => {
                vibrate(15);
                setZonaScelta(z);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto px-4 pt-6">
          <div className="flex items-center gap-3">
            <Link to="/minigiochi" className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors" aria-label="Torna ai minigiochi">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="page-title">Sfide 1vs1</h1>
              <p className="text-[11px] text-slate-500">
                Cinque rigori. Fino a {COINS.sfidaMaxReward} gettoni, una sfida per avversario ogni {COINS.sfidaCooldownDays} giorni.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        {fase === 'scelta' && (
          <>
            <PenaltyArena reveal={null} revealKey="scelta">
              <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
                  Il suo portiere para come giocano le sue statistiche
                </p>
              </div>
            </PenaltyArena>
            <div className="paper-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Swords size={16} className="text-primary-700" />
                <h2 className="font-black text-sm text-slate-900">Scegli chi sfidare</h2>
              </div>
              {avversari.length > 6 && (
                <label className="flex items-center gap-2 input-field py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    placeholder="Cerca un giocatore"
                    className="flex-1 bg-transparent outline-none text-sm"
                  />
                </label>
              )}
              {caricamento ? (
                <div className="flex items-center gap-2 text-slate-500 py-6 justify-center text-sm">
                  <Loader2 size={16} className="animate-spin" /> Carico i giocatori…
                </div>
              ) : avversariFiltrati.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">Nessun giocatore da sfidare.</p>
              ) : (
                <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {avversariFiltrati.map((a, i) => (
                    <li key={a.uid} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-300 to-primary-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                          {a.username.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{a.username}</p>
                          <p className="text-[11px] text-slate-500">#{i + 1} · {a.totalPoints.toFixed(1)} pt</p>
                        </div>
                      </div>
                      <button
                        onClick={() => iniziaSfida(a)}
                        disabled={avvio !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-500 text-night text-xs font-black hover:bg-primary-400 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {avvio === a.uid ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
                        Sfida
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {fase === 'tiri' && sfidato && (
          <>
            {invio ? (
              <div className="paper-card p-4 flex items-center justify-center gap-2 text-slate-600 text-sm font-bold">
                <Loader2 size={16} className="animate-spin" /> Il portiere si prepara…
              </div>
            ) : zonaScelta ? (
              <div className="paper-card p-4">
                <PenaltyPowerMeter key={`${tiri.length}-${zonaScelta}`} zone={zonaScelta} onConfirm={confermaTiro} onCancel={() => setZonaScelta(null)} />
              </div>
            ) : (
              <p className="text-center text-sm text-slate-600 font-bold">
                Tocca un bersaglio nella porta, poi ferma la barra di potenza.
              </p>
            )}
          </>
        )}

        {fase === 'rivelazione' && esito && (
          <p className="text-center text-sm text-slate-600 font-bold">
            {tiroCorrente ? 'Il tuo rigore…' : 'Conto i gol…'}
          </p>
        )}

        {fase === 'risultato' && esito && sfidato && (
          <div className="paper-card p-6 text-center space-y-5 animate-pop-in">
            <div className="text-6xl">{esito.won ? '🏆' : esito.draw ? '🤝' : '😤'}</div>
            <h2 className="font-display font-black text-3xl text-slate-900 uppercase">
              {esito.won ? 'Hai vinto!' : esito.draw ? 'Pareggio!' : 'Hai perso!'}
            </h2>

            <div className="flex items-center justify-center gap-8">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Tu</p>
                <p className="font-black text-5xl text-primary-700">{esito.myGoals}</p>
                <p className="text-sm mt-1">{esito.myResults.map(r => (r.goal ? '⚽' : '🧤')).join(' ')}</p>
              </div>
              <span className="text-2xl text-slate-300 font-black">–</span>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[120px]">{sfidato.username}</p>
                <p className="font-black text-5xl text-red-600">{esito.oppGoals}</p>
                <p className="text-sm mt-1">{esito.oppResults.map(r => (r.goal ? '⚽' : '🧤')).join(' ')}</p>
              </div>
            </div>

            {esito.reward > 0 ? (
              <div className="bg-gradient-to-r from-yellow-500/15 via-yellow-500/25 to-yellow-500/15 border border-yellow-500/30 rounded-2xl p-4">
                <p className="text-yellow-800/80 text-xs uppercase tracking-widest mb-1">Premio</p>
                <p className="font-black text-3xl text-yellow-700 flex items-center justify-center gap-2">
                  <Coins size={24} />+{esito.reward}
                </p>
              </div>
            ) : (
              !esito.messaggio && <p className="text-slate-500 text-sm">Nessun premio questa volta.</p>
            )}
            {esito.messaggio && <p className="text-slate-500 text-sm">{esito.messaggio}</p>}

            <div className="flex gap-2">
              <button onClick={ricomincia} className="flex-1 btn-green text-sm font-black py-3 flex items-center justify-center gap-2">
                <Swords size={16} /> Sfida un altro
              </button>
              <Link to="/minigiochi" className="flex items-center justify-center gap-2 flex-1 btn-secondary text-xs">
                <Trophy size={14} /> Minigiochi
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
