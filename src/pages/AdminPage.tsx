import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Users, Trophy, Calendar, Megaphone, Ban, Plus, Trash2,
  ToggleLeft, ToggleRight, Zap, AlertTriangle, BarChart3, Globe, RotateCcw,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  adminGetStatsFn, adminSyncMatchdayFn, adminForceSettleFn,
  adminManageSponsorFn, adminToggleBanFn, seedQuizQuestionsFn,
  adminManageCompetitionsFn, adminResetSeasonFn, type AdminStats, type SponsorData,
  type CompetitionStatus,
} from '@/lib/gameApi';
import { callableErrorMessage } from '@/lib/gameApi';
import { getPublicProfilesFn, type PublicProfileData } from '@/lib/gameApi';
import { cn } from '@/lib/utils';
import { COINS } from '@/lib/economy';

const STARTING_COINS = COINS.starting;

type Tab = 'stats' | 'matchday' | 'competitions' | 'sponsors' | 'users';

export function AdminPage() {
  const { profile } = useAuthContext();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await adminGetStatsFn();
      setStats(s);
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const t = setTimeout(() => loadStats(), 0);
      return () => clearTimeout(t);
    }
  }, [isAdmin, loadStats]);

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accesso Negato</h2>
          <p className="text-white/60">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'stats', label: 'Statistiche', icon: BarChart3 },
    { id: 'matchday', label: 'Giornate', icon: Calendar },
    { id: 'competitions', label: 'Campionati', icon: Globe },
    { id: 'sponsors', label: 'Sponsor', icon: Megaphone },
    { id: 'users', label: 'Utenti', icon: Users },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Zap size={28} className="text-primary-400" />
        <h1 className="text-2xl font-bold text-white">Pannello Admin</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface/50 border border-white/5 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="glass-card p-3 border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="glass-card p-3 border-green-500/30 bg-green-500/10 text-green-300 text-sm">
          {success}
        </div>
      )}

      {tab === 'stats' && <StatsTab stats={stats} loading={loading} onRefresh={loadStats} />}
      {tab === 'matchday' && <MatchdayTab onError={setError} onSuccess={setSuccess} />}
      {tab === 'competitions' && <CompetitionsTab onError={setError} onSuccess={setSuccess} />}
      {tab === 'sponsors' && <SponsorsTab onError={setError} onSuccess={setSuccess} />}
      {tab === 'users' && <UsersTab onError={setError} onSuccess={setSuccess} />}
    </div>
  );
}

// ============================================
// STATS TAB
// ============================================
function StatsTab({ stats, loading, onRefresh }: {
  stats: AdminStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading && !stats) {
    return <div className="text-white/40 text-center py-8">Caricamento...</div>;
  }
  if (!stats) return null;

  const cards = [
    { label: 'Utenti totali', value: stats.totalUsers, icon: Users, color: '#60a5fa' },
    { label: 'Utenti attivi', value: stats.activeUsers, icon: Users, color: '#22c55e' },
    { label: 'Schedine inviate', value: stats.totalSchedine, icon: Trophy, color: '#fbbf24' },
    { label: 'Giornate pending', value: stats.pendingMatchdays, icon: Calendar, color: '#f472b6' },
    { label: 'Sponsor attivi', value: stats.activeSponsors, icon: Megaphone, color: '#a78bfa' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Panoramica</h2>
        <button onClick={onRefresh} aria-label="Aggiorna panoramica" className="p-2 rounded-lg hover:bg-white/5 text-white/60">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} style={{ color: c.color }} />
                <span className="text-white/50 text-xs">{c.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{c.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MATCHDAY TAB
// ============================================
function MatchdayTab({ onError, onSuccess }: {
  onError: (s: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleNumber, setSettleNumber] = useState('');
  const [settleWarning, setSettleWarning] = useState<string | null>(null);
  const [resetConferma, setResetConferma] = useState('');
  const [resetting, setResetting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSync = async (forceOdds = false) => {
    setSyncing(true);
    onError('');
    try {
      const res = await adminSyncMatchdayFn(forceOdds);
      if (res.matchday) {
        onSuccess(`Giornata ${res.matchday.number} sincronizzata (${res.matchday.matches} partite)${forceOdds ? ' — quote rigenerate!' : ''}`);
      } else {
        onSuccess('Nessuna giornata disponibile da ESPN');
      }
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleSettle = async (force = false) => {
    const n = parseInt(settleNumber, 10);
    if (!n) { onError('Inserisci un numero di giornata valido'); return; }
    setSettling(true);
    onError('');
    try {
      const res = await adminForceSettleFn(n, force);
      setSettleWarning(null);
      onSuccess(`Giornata ${res.matchday} settleata: ${res.settled} schedine valutate`);
    } catch (e) {
      const messaggio = callableErrorMessage(e);
      // Il server rifiuta le giornate con partite ancora in corso: la richiesta
      // va ripetuta con `force`, ma deve essere una scelta esplicita.
      if (messaggio.includes('non concluse')) {
        setSettleWarning(messaggio);
      } else {
        onError(messaggio);
      }
    } finally {
      setSettling(false);
    }
  };

  const handleResetStagione = async () => {
    setResetting(true);
    onError('');
    try {
      const res = await adminResetSeasonFn();
      setResetConferma('');
      onSuccess(`Stagione azzerata: ${res.profili} profili riportati allo stato iniziale`);
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  const handleSeedQuiz = async () => {
    setSeeding(true);
    onError('');
    try {
      const res = await seedQuizQuestionsFn();
      onSuccess(res.message + (res.count > 0 ? ` (${res.count} domande)` : ''));
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h2 className="text-lg font-bold text-white mb-1">Sync Giornata</h2>
        <p className="text-white/50 text-sm mb-3">
          Forza la sincronizzazione della prossima giornata da ESPN + quote reali.
        </p>
        <button
          onClick={() => handleSync(false)}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/20 text-primary-300 border border-primary-500/30 hover:bg-primary-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizzazione...' : 'Sync ora'}
        </button>
        <button
          onClick={() => handleSync(true)}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 ml-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Rigenerazione...' : 'Rigenera quote'}
        </button>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-lg font-bold text-white mb-1">Force Settlement</h2>
        <p className="text-white/50 text-sm mb-3">
          Forza il settlement di una giornata specifica (fetch risultati + valutazione schedine).
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={38}
            value={settleNumber}
            onChange={e => setSettleNumber(e.target.value)}
            placeholder="N. giornata"
            aria-label="Numero giornata da liquidare"
            className="flex-1 px-3 py-2 rounded-xl bg-surface border border-white/10 text-white placeholder:text-white/30 focus:border-primary-500/50 outline-none"
          />
          <button
            onClick={() => handleSettle(false)}
            disabled={settling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            <Zap size={16} className={settling ? 'animate-pulse' : ''} />
            {settling ? 'Settlement...' : 'Settle'}
          </button>
        </div>

        {settleWarning && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-300 text-sm font-bold mb-1">{settleWarning}</p>
            <p className="text-white/50 text-xs mb-3">
              Valutare adesso conta come sbagliati i pronostici sulle partite non
              ancora giocate. L'operazione non è reversibile.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSettle(true)}
                disabled={settling}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                Valuta comunque
              </button>
              <button
                onClick={() => setSettleWarning(null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="glass-card p-5 border-red-500/30">
        <h2 className="text-lg font-bold text-white mb-1">Azzera stagione</h2>
        <p className="text-white/50 text-sm mb-1">
          Riporta <span className="font-bold text-white">tutti</span> i profili allo stato
          iniziale: punti, statistiche e missioni riscosse a zero, gettoni a {STARTING_COINS}.
        </p>
        <p className="text-white/40 text-xs mb-3">
          Schedine, giornate e premi passati restano come storico. L'operazione non è
          reversibile: scrivi AZZERA per abilitare il pulsante.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={resetConferma}
            onChange={e => setResetConferma(e.target.value)}
            placeholder="AZZERA"
            aria-label="Conferma azzeramento stagione"
            className="flex-1 px-3 py-2 rounded-xl bg-surface border border-white/10 text-white placeholder:text-white/30 focus:border-red-500/50 outline-none"
          />
          <button
            onClick={handleResetStagione}
            disabled={resetting || resetConferma !== 'AZZERA'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Azzeramento...' : 'Azzera'}
          </button>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-lg font-bold text-white mb-1">Seed Quiz DB</h2>
        <p className="text-white/50 text-sm mb-3">
          Carica tutte le domande del Quiz Calcio in Firestore (una tantum).
        </p>
        <button
          onClick={handleSeedQuiz}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={seeding ? 'animate-spin' : ''} />
          {seeding ? 'Caricamento...' : 'Seed domande quiz'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPETITIONS TAB
// ============================================
function CompetitionsTab({ onError, onSuccess }: {
  onError: (s: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [competitions, setCompetitions] = useState<CompetitionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminManageCompetitionsFn('list');
      setCompetitions(res.competitions ?? []);
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const activeCount = competitions.filter(c => c.active).length;

  const handleToggle = async (c: CompetitionStatus) => {
    setTogglingCode(c.code);
    try {
      await adminManageCompetitionsFn('toggle', { code: c.code });
      onSuccess(`${c.name} ${c.active ? 'disattivato' : 'attivato'}`);
      await load();
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setTogglingCode(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="glass-card p-4">
        <h2 className="text-lg font-bold text-white mb-1">Campionati Attivi</h2>
        <p className="text-white/50 text-sm">
          Le partite dei campionati attivi alimentano il pool da cui ogni utente sceglie
          le sue 10 partite. Utile per tenere il gioco vivo quando la Serie A è ferma
          (soste, fine stagione): attiva Champions League, Premier League, ecc.
        </p>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-8">Caricamento...</div>
      ) : (
        <div className="space-y-2">
          {competitions.map(c => (
            <div key={c.code} className="glass-card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{c.name}</p>
                <p className="text-white/30 text-xs">{c.code}</p>
              </div>
              <button
                onClick={() => handleToggle(c)}
                disabled={togglingCode === c.code}
                className={cn(
                  'p-1.5 rounded-lg disabled:opacity-40',
                  c.active ? 'text-green-400' : 'text-white/30'
                )}
                title={c.active ? 'Attivo' : 'Disattivato'}
                aria-label={`${c.name}: ${c.active ? 'Attivo, clicca per disattivare' : 'Disattivato, clicca per attivare'}`}
                aria-pressed={c.active}
              >
                {c.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
            </div>
          ))}
          {activeCount === 0 && (
            <div className="glass-card p-3 border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm text-center">
              Nessun campionato attivo: il pool partite sarà vuoto al prossimo sync.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SPONSORS TAB
// ============================================
function SponsorsTab({ onError, onSuccess }: {
  onError: (s: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [sponsors, setSponsors] = useState<SponsorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', tagline: '', accent: '#84d80c', href: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminManageSponsorFn('list');
      setSponsors(res.sponsors ?? []);
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) { onError('Nome sponsor obbligatorio'); return; }
    try {
      await adminManageSponsorFn('create', {
        name: form.name,
        tagline: form.tagline,
        accent: form.accent,
        href: form.href || null,
      });
      onSuccess('Sponsor creato');
      setForm({ name: '', tagline: '', accent: '#84d80c', href: '' });
      setShowForm(false);
      load();
    } catch (e) {
      onError(callableErrorMessage(e));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await adminManageSponsorFn('toggle', { sponsorId: id });
      load();
    } catch (e) {
      onError(callableErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminManageSponsorFn('delete', { sponsorId: id });
      onSuccess('Sponsor eliminato');
      load();
    } catch (e) {
      onError(callableErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Sponsor ({sponsors.length})</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-300 border border-primary-500/30 text-sm hover:bg-primary-500/30"
        >
          <Plus size={14} />
          Nuovo
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-4 space-y-3">
          <input
            type="text"
            placeholder="Nome sponsor"
            aria-label="Nome sponsor"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-white/10 text-white placeholder:text-white/30 focus:border-primary-500/50 outline-none"
          />
          <input
            type="text"
            placeholder="Tagline (opzionale)"
            aria-label="Tagline sponsor"
            value={form.tagline}
            onChange={e => setForm({ ...form, tagline: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-white/10 text-white placeholder:text-white/30 focus:border-primary-500/50 outline-none"
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={form.accent}
              onChange={e => setForm({ ...form, accent: e.target.value })}
              aria-label="Colore accento sponsor"
              className="w-12 h-10 rounded-lg bg-surface border border-white/10 cursor-pointer"
            />
            <input
              type="text"
              placeholder="URL link (opzionale)"
              aria-label="URL link sponsor"
              value={form.href}
              onChange={e => setForm({ ...form, href: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-surface border border-white/10 text-white placeholder:text-white/30 focus:border-primary-500/50 outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            className="w-full py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600"
          >
            Crea sponsor
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-center py-4">Caricamento...</div>
      ) : sponsors.length === 0 ? (
        <div className="text-white/40 text-center py-8 text-sm">Nessuno sponsor. Clicca "Nuovo" per aggiungerne.</div>
      ) : (
        <div className="space-y-2">
          {sponsors.map(s => (
            <div key={s.id} className="glass-card p-3 flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.accent }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{s.name}</p>
                {s.tagline && <p className="text-white/40 text-xs truncate">{s.tagline}</p>}
              </div>
              <button
                onClick={() => handleToggle(s.id)}
                className={cn('p-1.5 rounded-lg', s.active ? 'text-green-400' : 'text-white/30')}
                title={s.active ? 'Attivo' : 'Disattivato'}
                aria-label={`${s.name}: ${s.active ? 'Attivo, clicca per disattivare' : 'Disattivato, clicca per attivare'}`}
                aria-pressed={s.active}
              >
                {s.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                aria-label={`Elimina sponsor ${s.name}`}
                className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// USERS TAB
// ============================================
function UsersTab({ onError, onSuccess }: {
  onError: (s: string) => void;
  onSuccess: (s: string) => void;
}) {
  const [users, setUsers] = useState<PublicProfileData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { profiles: list } = await getPublicProfilesFn();
      setUsers(list);
    } catch (e) {
      onError(callableErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleBan = async (uid: string, username: string) => {
    try {
      const res = await adminToggleBanFn(uid);
      onSuccess(`${username} ${res.isActive ? 'riattivato' : 'bannato'}`);
      load();
    } catch (e) {
      onError(callableErrorMessage(e));
    }
  };

  if (loading) return <div className="text-white/40 text-center py-8">Caricamento...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Utenti ({users.length})</h2>
        <button onClick={load} aria-label="Aggiorna elenco utenti" className="p-2 rounded-lg hover:bg-white/5 text-white/60">
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-white/60 text-xs font-bold overflow-hidden">
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                u.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{u.username}</p>
              <p className="text-white/40 text-xs">{u.totalPoints} pt</p>
            </div>
            <button
              onClick={() => handleBan(u.id, u.username)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                u.isActive === false
                  ? 'bg-green-500/10 text-green-300 border-green-500/20 hover:bg-green-500/20'
                  : 'bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20'
              )}
            >
              <Ban size={14} />
              {u.isActive === false ? 'Riattiva' : 'Ban'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
