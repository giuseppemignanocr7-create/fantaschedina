import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Users, Trophy, LogOut, Trash2, Loader2, KeyRound,
  ChevronRight, Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

  // Form join
  const [inviteCode, setInviteCode] = useState('');

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
        parseInt(maxMembers, 10) || 20
      );
      setNome('');
      setDescrizione('');
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
            <Link to="/" className="p-1.5 text-white/60 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="page-title">LEGHE PRIVATE</h1>
          </div>
          <button
            onClick={() => setActiveTab(1)}
            className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-400 text-white font-bold text-xs uppercase tracking-wide px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            CREA LEGA
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface rounded-xl p-1 border border-white/5">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={cn(
                'flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all',
                activeTab === i
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <div className="glass-card p-3 mb-4 border-red-500/30 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* TAB 0: Le mie leghe */}
        {activeTab === 0 && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={28} className="text-primary-400 animate-spin" />
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="glass-card p-8 text-center animate-pop-in">
                <p className="text-5xl mb-3 animate-float inline-block">🏟️</p>
                <p className="font-bold text-white mb-1">Nessuna lega... per ora!</p>
                <p className="text-xs text-white/40 mb-4">
                  Sfida i tuoi amici: crea la tua lega o entra con un codice invito
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setActiveTab(1)} className="btn-green text-xs px-4 py-2.5 active:scale-95 transition-transform">
                    ➕ CREA LEGA
                  </button>
                  <button onClick={() => setActiveTab(2)} className="text-xs font-black uppercase px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all active:scale-95">
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
                      className="block p-4 hover:bg-white/5 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-white truncate">
                            {league.name}
                            {isOwner && (
                              <span className="ml-2 text-[9px] font-bold text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase">
                                Owner
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-white/40 truncate">
                            {league.description || 'Schedina, classifica e partite della lega'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="flex items-center gap-1 text-xs text-white/50">
                            <Users size={12} />
                            {league.memberCount}/{league.maxMembers}
                          </span>
                          <ChevronRight size={18} className="text-primary-300" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                        <span className="flex items-center gap-1">
                          <Target size={10} /> Schedina
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy size={10} /> Classifica
                        </span>
                        <span className="flex items-center gap-1">
                          <KeyRound size={10} /> {league.inviteCode}
                        </span>
                      </div>
                    </Link>

                    <div className="flex justify-end gap-2 px-4 pb-3 -mt-1">
                      {isOwner ? (
                        <button
                          onClick={() => handleDelete(league)}
                          disabled={busy}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} /> Elimina lega
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLeave(league)}
                          disabled={busy}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
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
              <label htmlFor="leagueName" className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1.5">
                Nome lega *
              </label>
              <input
                id="leagueName"
                value={nome}
                onChange={e => setNome(e.target.value)}
                maxLength={40}
                placeholder="Amici del Gol"
                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="leagueDescription" className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1.5">
                Descrizione
              </label>
              <input
                id="leagueDescription"
                value={descrizione}
                onChange={e => setDescrizione(e.target.value)}
                maxLength={80}
                placeholder="Sfida tra amici veri!"
                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leagueVisibility" className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1.5">
                  Visibilità
                </label>
                <select
                  id="leagueVisibility"
                  value={isPrivate ? 'private' : 'public'}
                  onChange={e => setIsPrivate(e.target.value === 'private')}
                  className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary-500/50 focus:outline-none"
                >
                  <option value="private">Solo su invito</option>
                  <option value="public">Pubblica</option>
                </select>
              </div>
              <div>
                <label htmlFor="leagueMaxMembers" className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-1.5">
                  Max partecipanti
                </label>
                <select
                  id="leagueMaxMembers"
                  value={maxMembers}
                  onChange={e => setMaxMembers(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-primary-500/50 focus:outline-none"
                >
                  {['10', '20', '50', '100'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!nome.trim() || busy}
              className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
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
              <label htmlFor="leagueInviteCode" className="text-[10px] font-bold uppercase tracking-widest text-white/40 block">
                Codice invito
              </label>
              <div className="flex gap-2">
                <input
                  id="leagueInviteCode"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  className="flex-1 bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-white placeholder:text-white/20 focus:border-primary-500/50 focus:outline-none uppercase"
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={inviteCode.trim().length < 6 || busy}
                  className="px-4 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase transition-colors"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : 'ENTRA'}
                </button>
              </div>
            </div>

            {/* Leghe pubbliche */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Leghe pubbliche
              </p>
              {publicLeagues.length === 0 ? (
                <div className="glass-card p-5 text-center text-xs text-white/40">
                  Nessuna lega pubblica disponibile
                </div>
              ) : (
                <div className="space-y-2">
                  {publicLeagues.map(league => (
                    <div key={league.id} className="glass-card p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate">{league.name}</p>
                        <p className="text-[11px] text-white/40 truncate">
                          {league.memberCount}/{league.maxMembers} membri · di {league.ownerName}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinPublic(league.id)}
                        disabled={busy || league.memberCount >= league.maxMembers}
                        className="px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/40 text-primary-400 font-black text-[10px] uppercase hover:bg-primary-500/30 disabled:opacity-40 transition-colors"
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
