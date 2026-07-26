import { useState } from 'react';
import {
  User, Coins, HelpCircle, LogOut, ChevronRight, Trophy, Gamepad2,
  Shield, Download, Trash2, Loader2, AlertTriangle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppStore } from '@/store';
import { exportMyDataFn, deleteAccountFn, callableErrorMessage } from '@/lib/gameApi';

const menuItems = [
  { icon: User, label: 'Modifica Profilo', desc: 'Nome, avatar, bio', to: '/profilo' },
  { icon: Trophy, label: 'Le mie Leghe', desc: 'Gestisci le tue leghe', to: '/leghe' },
  { icon: Gamepad2, label: 'Sala Giochi', desc: 'Quiz, ruota, rigori', to: '/minigiochi' },
  { icon: HelpCircle, label: 'Regolamento', desc: 'Regole e punteggi', to: '/regolamento' },
];

export function AccountPage() {
  const { profile, user, signOut } = useAuthContext();
  const { currentUser } = useAppStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');

  const username = profile?.username ?? currentUser?.username ?? 'Ospite';
  const initials = username.slice(0, 2).toUpperCase();
  const points = currentUser?.totalPoints ?? 0;
  const rank = currentUser?.rank ?? '—';
  const coins = profile?.coins ?? 0;

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleExport = async () => {
    setBusy('export');
    setError(null);
    try {
      const data = await exportMyDataFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fantaschedina-dati-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(callableErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    setError(null);
    try {
      await deleteAccountFn('ELIMINA');
      await signOut();
      navigate('/login', { replace: true });
    } catch (e) {
      setError(callableErrorMessage(e));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">

        <div className="flex items-center gap-2 mb-1">
          <User size={20} className="text-primary-400" />
          <h1 className="page-title">ACCOUNT</h1>
        </div>

        {/* Profile hero */}
        <div className="glass-card p-5 flex flex-col items-center text-center animate-pop-in">
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border-2 border-primary-500/40 flex items-center justify-center font-display font-black text-2xl text-white shadow-lg shadow-primary-500/30">
              {initials}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display font-black text-xl text-white">{username}</h2>
          </div>
          {user?.email && <p className="text-sm text-white/50">{user.email}</p>}
          <div className="mt-3 flex gap-4 text-center">
            <div>
              <p className="text-lg font-black text-primary-400">{points.toFixed(1)}</p>
              <p className="text-[9px] text-white/40 uppercase">Punti</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <p className="text-lg font-black text-white">#{rank}</p>
              <p className="text-[9px] text-white/40 uppercase">Posizione</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <p className="text-lg font-black text-yellow-400 flex items-center gap-1 justify-center"><Coins size={14} />{coins}</p>
              <p className="text-[9px] text-white/40 uppercase">Gettoni</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="glass-card overflow-hidden divide-y divide-white/5">
          {menuItems.map((item, mi) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors animate-slide-up"
                style={{ animationDelay: `${mi * 50}ms`, animationFillMode: 'backwards' }}
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon size={17} className="text-primary-400" strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="text-[10px] text-white/40">{item.desc}</p>
                </div>
                <ChevronRight size={16} className="text-white/20" />
              </Link>
            );
          })}
        </div>

        {/* Privacy e dati personali */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary-400" />
            <p className="font-black text-sm text-white">Privacy e dati</p>
          </div>

          <Link
            to="/privacy"
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            <HelpCircle size={17} className="text-white/50 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Informativa Privacy</p>
              <p className="text-[10px] text-white/40">Quali dati trattiamo e perché</p>
            </div>
            <ChevronRight size={16} className="text-white/20" />
          </Link>

          <button
            onClick={handleExport}
            disabled={busy !== null}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {busy === 'export'
              ? <Loader2 size={17} className="text-white/50 flex-shrink-0 animate-spin" />
              : <Download size={17} className="text-white/50 flex-shrink-0" />}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-white">Scarica i miei dati</p>
              <p className="text-[10px] text-white/40">Esporta tutto in formato JSON</p>
            </div>
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy !== null}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              <Trash2 size={17} className="text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-red-400">Elimina account</p>
                <p className="text-[10px] text-white/40">Cancellazione definitiva di tutti i dati</p>
              </div>
            </button>
          ) : (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-400">Operazione irreversibile</p>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Verranno eliminati profilo, schedine, gettoni, cronologia e leghe di cui sei
                    proprietario. Non è possibile annullare.
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="confirmWord" className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                  Scrivi ELIMINA per confermare
                </label>
                <input
                  id="confirmWord"
                  value={confirmWord}
                  onChange={e => setConfirmWord(e.target.value.toUpperCase())}
                  placeholder="ELIMINA"
                  autoComplete="off"
                  className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-center font-black text-white tracking-widest focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmDelete(false); setConfirmWord(''); }}
                  disabled={busy !== null}
                  className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs uppercase transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  disabled={busy !== null || confirmWord !== 'ELIMINA'}
                  className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy === 'delete' && <Loader2 size={14} className="animate-spin" />}
                  Elimina
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full glass-card p-4 flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors rounded-2xl active:scale-[0.98]"
        >
          <LogOut size={16} />
          <span className="font-bold text-sm uppercase tracking-wide">Esci dall&apos;account</span>
        </button>

        <p className="text-center text-[10px] text-white/20 pb-2">
          FantaSchedina v1.0 — Solo maggiorenni
        </p>

      </div>
    </div>
  );
}
