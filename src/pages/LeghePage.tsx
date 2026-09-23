import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Plus, Users, Trophy, LogOut, Trash2, Loader2, KeyRound,
  ChevronRight, Target, Share2, Check,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';
import { burstConfetti, vibrate } from '@/lib/juice';
import {
  createLeague,
  deleteLeague,
  getPublicLeagues,
  getUserLeagues,
  joinLeague,
  joinLeagueByCode,
  leaveLeague,
  type LeagueDoc,
} from '@/lib/leagues';

const TABS = ['LE MIE LEGHE', 'CREA LEGA', 'UNISCITI'] as const;

export function LeghePage() {
  const { user, profile } = useAuthContext();
  const uid = user?.uid ?? '';

  const [activeTab, setActiveTab] = useState(0);
  const [myLeagues, setMyLeagues] = useState<LeagueDoc[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<LeagueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form crea lega
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [maxMembers, setMaxMembers] = useState('20');
  // Agenzia per il palinsesto delle quote: la scrive chi crea la lega, poi
  // l'amministratore la assegna. Vuota = quote standard, lega subito attiva.
  const [agenzia, setAgenzia] = useState('');

  // Form join
  const [inviteCode, setInviteCode] = useState('');

  // Invito arrivato da un link: si entra senza dover copiare niente.
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invito = searchParams.get('invito');
  const invitoGestito = useRef(false);
  const [statoInvito, setStatoInvito] = useState<'attesa' | 'errore' | null>(null);

  // Codice invito copiato o condiviso, per il riscontro visivo sulla card.
  const [codiceCondiviso, setCodiceCondiviso] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [mine, pub] = await Promise.all([getUserLeagues(uid), getPublicLeagues()]);
      setMyLeagues(mine);
      setPublicLeagues(pub.filter(l => !l.memberIds.includes(uid)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const t = setTimeout(() => refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  /**
   * Link d'invito: `/leghe?invito=CODICE`. Entrare e' cio' che chi tocca il
   * link vuole fare, quindi si fa subito e si porta l'utente nella lega; se
   * e' gia' dentro (o il codice non vale piu') resta il modulo manuale con
   * il codice gia' scritto.
   */
  useEffect(() => {
    if (!uid || !invito || invitoGestito.current) return;
    invitoGestito.current = true;
    const codice = invito.toUpperCase().trim();
    setInviteCode(codice);
    setStatoInvito('attesa');
    setError(null);

    void (async () => {
      try {
        await joinLeagueByCode(uid, codice);
        vibrate([40, 30, 60]);
        burstConfetti();
        const mie = await getUserLeagues(uid);
        setMyLeagues(mie);
        const entrata = mie.find(l => l.inviteCode === codice);
        setStatoInvito(null);
        setSearchParams({}, { replace: true });
        if (entrata) navigate(`/leghe/${entrata.id}`, { replace: true });
      } catch (e) {
        setStatoInvito('errore');
        setError((e as Error).message);
        setActiveTab(2);
        setSearchParams({}, { replace: true });
      }
    })();
  }, [uid, invito, navigate, setSearchParams]);

  /** Condivide il link d'invito: foglio di sistema se c'e', altrimenti copia. */
  const condividiLega = async (league: LeagueDoc) => {
    const url = `${window.location.origin}/leghe?invito=${league.inviteCode}`;
    const testo = `Entra nella mia lega "${league.name}" su Fantaschedina!`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Fantaschedina', text: testo, url });
        return;
      } catch {
        // Condivisione annullata dall'utente: si ripiega sulla copia.
      }
    }
    try {
      await navigator.clipboard.writeText(`${testo} ${url}`);
      setCodiceCondiviso(league.id);
      setTimeout(() => setCodiceCondiviso(null), 2000);
    } catch {
      setError('Non riesco a copiare il link: usa il codice ' + league.inviteCode);
    }
  };

  const handleCreate = async () => {
    if (!nome.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createLeague(
        uid,
        profile?.username ?? 'player',
        nome,
        descrizione,
        isPrivate,
        parseInt(maxMembers, 10) || 20,
        agenzia.trim()
      );
      setNome('');
      setDescrizione('');
      setAgenzia('');
      setActiveTab(0);
      vibrate([40, 30, 60]);
      burstConfetti();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinLeagueByCode(uid, inviteCode);
      setInviteCode('');
      setActiveTab(0);
      vibrate([40, 30, 60]);
      burstConfetti();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoinPublic = async (leagueId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinLeague(uid, leagueId);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (league: LeagueDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveLeague(uid, league.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (league: LeagueDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteLeague(league.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="page-title">LEGHE PRIVATE</h1>
          </div>
          <button
            onClick={() => setActiveTab(1)}
            className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-400 text-night font-bold text-xs uppercase tracking-wide px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            CREA LEGA
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface rounded-xl p-1 border border-slate-200">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={cn(
                'flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all',
                activeTab === i
                  ? 'bg-primary-500/20 text-primary-800 border border-primary-500/30'
                  : 'text-slate-500 hover:text-slate-500'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <div className="glass-card p-3 mb-4 border-red-500/30 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* TAB 0: Le mie leghe */}
        {statoInvito === 'attesa' && (
          <div className="glass-card p-4 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-primary-700 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">Ti stiamo facendo entrare…</p>
              <p className="text-xs text-slate-500">Invito con codice {invito}</p>
            </div>
          </div>
        )}

        {activeTab === 0 && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={28} className="text-primary-700 animate-spin" />
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="glass-card p-8 text-center animate-pop-in">
                <p className="text-5xl mb-3 animate-float inline-block">🏟️</p>
                <p className="font-bold text-slate-900 mb-1">Nessuna lega... per ora!</p>
                <p className="text-xs text-slate-500 mb-4">
                  Sfida i tuoi amici: crea la tua lega o entra con un codice invito
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setActiveTab(1)} className="btn-green text-xs px-4 py-2.5 active:scale-95 transition-transform">
                    ➕ CREA LEGA
                  </button>
                  <button onClick={() => setActiveTab(2)} className="text-xs font-black uppercase px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all active:scale-95">
                    🔑 HO UN CODICE
                  </button>
                </div>
              </div>
            ) : (
              myLeagues.map((league, li) => {
                const isOwner = league.ownerId === uid;
                return (
                  <div
                    key={league.id}
                    className="glass-card overflow-hidden animate-slide-up"
                    style={{ animationDelay: `${li * 60}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* La scheda porta dentro la lega: schedina, classifica,
                        partite e membri stanno tutti li’, come in un
                        fantacalcio. Prima si apriva a fisarmonica e finiva li’. */}
                    <Link
                      to={`/leghe/${league.id}`}
                      className="block p-4 hover:bg-slate-100 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 truncate">
                            {league.name}
                            {isOwner && (
                              <span className="ml-2 text-[9px] font-bold text-yellow-700 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase">
                                Owner
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {league.description || 'Schedina, classifica e partite della lega'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Users size={12} />
                            {league.memberCount}/{league.maxMembers}
                          </span>
                          <ChevronRight size={18} className="text-primary-700" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <span className="flex items-center gap-1">
                          <Target size={10} /> Schedina
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy size={10} /> Classifica
                        </span>
                        <span className="flex items-center gap-1">
                          <KeyRound size={10} /> {league.inviteCode}
                        </span>
                        {league.stato === 'in_attesa' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-800 normal-case tracking-normal">
                            In attesa dell'agenzia {league.agenziaRichiesta}
                          </span>
                        )}
                        {league.bookmaker && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-800 normal-case tracking-normal">
                            Quote {league.bookmaker}
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="flex justify-end gap-2 px-4 pb-3 -mt-1">
                      <button
                        onClick={() => void condividiLega(league)}
                        className="flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-800 px-2 py-1 rounded-lg hover:bg-primary-500/10 transition-all mr-auto"
                      >
                        {codiceCondiviso === league.id ? (
                          <><Check size={12} /> Link copiato</>
                        ) : (
                          <><Share2 size={12} /> Invita amici</>
                        )}
                      </button>
                      {isOwner ? (
                        <button
                          onClick={() => handleDelete(league)}
                          disabled={busy}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} /> Elimina lega
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLeave(league)}
                          disabled={busy}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          <LogOut size={12} /> Abbandona
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 1: Crea lega */}
        {activeTab === 1 && (
          <div className="glass-card p-4 space-y-4">
            <div>
              <label htmlFor="leagueName" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                Nome lega *
              </label>
              <input
                id="leagueName"
                value={nome}
                onChange={e => setNome(e.target.value)}
                maxLength={40}
                placeholder="Amici del Gol"
                className="w-full bg-surface border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-600 focus:border-primary-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="leagueDescription" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                Descrizione
              </label>
              <input
                id="leagueDescription"
                value={descrizione}
                onChange={e => setDescrizione(e.target.value)}
                maxLength={80}
                placeholder="Sfida tra amici veri!"
                className="w-full bg-surface border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-600 focus:border-primary-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leagueVisibility" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                  Visibilità
                </label>
                <select
                  id="leagueVisibility"
                  value={isPrivate ? 'private' : 'public'}
                  onChange={e => setIsPrivate(e.target.value === 'private')}
                  className="w-full bg-surface border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500/50 focus:outline-none"
                >
                  <option value="private">Solo su invito</option>
                  <option value="public">Pubblica</option>
                </select>
              </div>
              <div>
                <label htmlFor="leagueMaxMembers" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                  Max partecipanti
                </label>
                <select
                  id="leagueMaxMembers"
                  value={maxMembers}
                  onChange={e => setMaxMembers(e.target.value)}
                  className="w-full bg-surface border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500/50 focus:outline-none"
                >
                  {['10', '20', '50', '100'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
              <div className="space-y-1">
                <label htmlFor="leagueAgenzia" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                  Agenzia per le quote (facoltativa)
                </label>
                <input
                  id="leagueAgenzia"
                  value={agenzia}
                  onChange={e => setAgenzia(e.target.value)}
                  maxLength={40}
                  placeholder="Es. Sisal, Snai, Eurobet…"
                  className="input-field"
                />
                <p className="text-[10px] text-slate-500">
                  Scrivi l'agenzia con cui vuoi confrontare le quote: la richiesta arriva
                  all'amministratore, che collega il palinsesto. Finché non lo fa la lega resta
                  in attesa. Lasciando vuoto si gioca subito sulle quote standard.
                </p>
              </div>

            <button
              onClick={handleCreate}
              disabled={!nome.trim() || busy}
              className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed text-night font-black text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crea lega
            </button>
          </div>
        )}

        {/* TAB 2: Unisciti */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <label htmlFor="leagueInviteCode" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                Codice invito
              </label>
              <div className="flex gap-2">
                <input
                  id="leagueInviteCode"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  className="flex-1 bg-surface border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-slate-900 placeholder:text-slate-600 focus:border-primary-500/50 focus:outline-none uppercase"
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={inviteCode.trim().length < 6 || busy}
                  className="px-4 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed text-night font-black text-xs uppercase transition-colors"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : 'ENTRA'}
                </button>
              </div>
            </div>

            {/* Leghe pubbliche */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Leghe pubbliche
              </p>
              {publicLeagues.length === 0 ? (
                <div className="glass-card p-5 text-center text-xs text-slate-500">
                  Nessuna lega pubblica disponibile
                </div>
              ) : (
                <div className="space-y-2">
                  {publicLeagues.map(league => (
                    <div key={league.id} className="glass-card p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{league.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {league.memberCount}/{league.maxMembers} membri · di {league.ownerName}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinPublic(league.id)}
                        disabled={busy || league.memberCount >= league.maxMembers}
                        className="px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-800 font-black text-[10px] uppercase hover:bg-primary-500/30 disabled:opacity-40 transition-colors"
                      >
                        Unisciti
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
