import { useState } from 'react';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar,
  Award,
  Star,
  Flame,
  CheckCircle2,
  Shield,
  Zap,
  Edit3,
  Lock,
  Mail,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { useAuthContext } from '@/contexts/AuthContext';

export function ProfiloPage() {
  const { currentUser, rankings } = useAppStore();
  const {
    user: authUser,
    profile,
    signOut,
    updateProfile,
    changePassword,
  } = useAuthContext();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editUsername, setEditUsername] = useState(profile?.username ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  if (!currentUser || !profile) return null;
  const user = currentUser;
  const userRanking = rankings.find(r => r.participantId === user.id);
  const userPosition = userRanking?.rank || rankings.length + 1;
  const totalPredictions = profile.matchdaysPlayed * 10;

  const stats = {
    totalSchedine: profile.matchdaysPlayed,
    correctPredictions: profile.correctPredictions,
    totalPredictions,
    winRate:
      totalPredictions > 0 ? Math.round((profile.correctPredictions / totalPredictions) * 100) : 0,
    weeklyWins: profile.weeklyWins,
    bestMatchday: profile.bestMatchdayPoints,
    avgPoints:
      profile.matchdaysPlayed > 0 ? profile.totalPoints / profile.matchdaysPlayed : 0,
    perfectSchedine: profile.perfectSchedine,
    bonusTotal: profile.bonusPointsTotal,
    penaltyTotal: profile.penaltyPointsTotal,
    currentStreak: 0,
  };

  const handleProfileSave = async () => {
    const username = editUsername.trim();
    if (username.length < 2 || username.length > 30) {
      setFormError('Lo username deve contenere da 2 a 30 caratteri');
      return;
    }
    setSavingProfile(true);
    setFormError(null);
    const result = await updateProfile({ username });
    setSavingProfile(false);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    setIsEditing(false);
  };

  const handlePasswordSave = async () => {
    setFormError(null);
    if (newPassword !== confirmPassword) {
      setFormError('Le nuove password non coincidono');
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.error) {
      setFormError(result.error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(false);
  };

  const allBadges = [
    { id: 'first', name: 'Prima Schedina', desc: 'Hai inviato la tua prima schedina', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', unlocked: true },
    { id: 'week5', name: '5 Settimane', desc: 'Hai partecipato a 5 giornate', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/20', unlocked: stats.totalSchedine >= 5 },
    { id: 'week10', name: '10 Settimane', desc: 'Hai partecipato a 10 giornate', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/20', unlocked: stats.totalSchedine >= 10 },
    { id: 'winner', name: 'Vincitore', desc: 'Hai vinto una giornata', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20', unlocked: stats.weeklyWins > 0 },
    { id: 'winner3', name: 'Tripla Vittoria', desc: 'Hai vinto 3 giornate', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20', unlocked: stats.weeklyWins >= 3 },
    { id: 'perfect', name: '10/10 Perfetto', desc: 'Hai indovinato tutti i pronostici', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/20', unlocked: stats.perfectSchedine > 0 },
    { id: 'accuracy70', name: 'Precisione 70%', desc: 'Precisione superiore al 70%', icon: Target, color: 'text-green-400', bg: 'bg-green-500/20', unlocked: stats.winRate >= 70 },
    { id: 'streak3', name: 'Streak 3', desc: '3 settimane consecutive', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20', unlocked: stats.currentStreak >= 3 },
    { id: 'streak5', name: 'Streak 5', desc: '5 settimane consecutive', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20', unlocked: stats.currentStreak >= 5 },
    { id: 'top3', name: 'Top 3', desc: 'Sei nei primi 3 in classifica', icon: Award, color: 'text-primary-400', bg: 'bg-primary-500/20', unlocked: userPosition <= 3 },
    { id: 'top1', name: 'Primo!', desc: 'Sei primo in classifica', icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/20', unlocked: userPosition === 1 },
    { id: 'highscore', name: 'High Score', desc: 'Oltre 5 punti in una giornata', icon: Zap, color: 'text-accent-400', bg: 'bg-accent-500/20', unlocked: stats.bestMatchday >= 5 },
  ];

  const unlockedCount = allBadges.filter(b => b.unlocked).length;

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="glass-card p-6 sm:p-8 mb-6 relative overflow-hidden animate-pop-in">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary-900 to-primary-800 opacity-50" />
          <div className="flex flex-col sm:flex-row items-end gap-6 relative z-10 pt-12">
            {/* Avatar */}
            <div className="relative -mb-4 sm:mb-0">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-surface border-4 border-surface shadow-2xl flex items-center justify-center overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-400 opacity-20 group-hover:opacity-30 transition-opacity" />
                <span className="text-4xl sm:text-5xl font-display font-black text-white z-10">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              {userPosition <= 3 && (
                <div className={cn(
                  'absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-4 border-surface shadow-lg',
                  userPosition === 1 ? 'bg-yellow-500' : userPosition === 2 ? 'bg-gray-400' : 'bg-orange-500'
                )}>
                  <Trophy size={18} className="text-white fill-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left mb-2">
              {isEditing ? (
                <input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  maxLength={30}
                  className="w-full max-w-xs input-field bg-surface text-center sm:text-left mb-2"
                  aria-label="Username"
                />
              ) : (
                <h1 className="text-3xl sm:text-4xl font-display font-black uppercase italic tracking-tight text-white mb-1">
                  {user.username}
                </h1>
              )}
              <p className="text-slate-400 flex items-center justify-center sm:justify-start gap-2 mb-4 font-medium text-sm">
                <Mail size={14} />
                {authUser?.email ?? ''}
              </p>
              {isEditing && formError && <p className="text-sm text-red-400 mb-3">{formError}</p>}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span className="px-3 py-1 rounded bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-bold uppercase tracking-wider">
                  Rank #{userPosition}
                </span>
                <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  Membro dalla G{profile.joinedMatchday}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 w-full sm:w-auto mb-2">
              <button 
                onClick={() => {
                  if (isEditing) {
                    void handleProfileSave();
                  } else {
                    setEditUsername(profile.username);
                    setFormError(null);
                    setIsEditing(true);
                  }
                }}
                disabled={savingProfile}
                className="btn-secondary text-xs py-2.5 px-4 flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
                {isEditing ? 'Salva Profilo' : 'Modifica Profilo'}
              </button>
              {isEditing && (
                <button
                  onClick={() => {
                    setEditUsername(profile.username);
                    setFormError(null);
                    setIsEditing(false);
                  }}
                  className="text-xs py-1 text-slate-500 hover:text-white uppercase tracking-wide transition-colors"
                >
                  Annulla
                </button>
              )}
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="text-xs py-2 px-4 text-slate-500 hover:text-white flex items-center justify-center gap-2 uppercase tracking-wide transition-colors"
              >
                <Lock size={14} />
                Sicurezza
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card p-4 text-center border-t-2 border-primary-500 animate-slide-up hover:scale-[1.03] transition-transform" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
            <Zap size={24} className="text-primary-400 mx-auto mb-2" />
            <p className="text-3xl font-mono font-bold text-white">{user.totalPoints}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Punti Totali</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-green-500 animate-slide-up hover:scale-[1.03] transition-transform" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
            <Target size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-mono font-bold text-green-400">{stats.winRate}%</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Precisione</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-yellow-500 animate-slide-up hover:scale-[1.03] transition-transform" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
            <Trophy size={24} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-3xl font-mono font-bold text-yellow-400">{stats.weeklyWins}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vittorie</p>
          </div>
          <div className="glass-card p-4 text-center border-t-2 border-accent-500 animate-slide-up hover:scale-[1.03] transition-transform" style={{ animationDelay: '320ms', animationFillMode: 'backwards' }}>
            <TrendingUp size={24} className="text-accent-400 mx-auto mb-2" />
            <p className="text-3xl font-mono font-bold text-white">{stats.avgPoints.toFixed(1)}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Media Punti</p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="glass-card p-6 mb-6">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
            <TrendingUp size={20} className="text-primary-400" />
            Statistiche Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Schedine</p>
              <p className="font-mono font-bold text-xl text-white">{stats.totalSchedine}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Pronostici Esatti</p>
              <p className="font-mono font-bold text-xl text-white">{stats.correctPredictions}<span className="text-slate-600 text-sm">/{stats.totalPredictions}</span></p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Miglior Punteggio</p>
              <p className="font-mono font-bold text-xl text-primary-400">{stats.bestMatchday} <span className="text-xs">pt</span></p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Perfetti 10/10</p>
              <p className="font-mono font-bold text-xl text-white">{stats.perfectSchedine}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Bonus</p>
              <p className="font-mono font-bold text-xl text-green-400">+{stats.bonusTotal}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-white/5">
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Penalità</p>
              <p className="font-mono font-bold text-xl text-live">{stats.penaltyTotal}</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
              <Award size={20} className="text-primary-400" />
              Traguardi ({unlockedCount}/{allBadges.length})
            </h3>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {Math.round((unlockedCount / allBadges.length) * 100)}% Completato
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-3 bg-surface rounded-full mb-6 overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 relative"
              style={{ width: `${(unlockedCount / allBadges.length) * 100}%` }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 4px, transparent 4px, transparent 12px)' }} />
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {allBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div 
                  key={badge.id}
                  className={cn(
                    'aspect-square rounded-xl flex flex-col items-center justify-center p-3 transition-all relative group border',
                    badge.unlocked 
                      ? `${badge.bg} border-white/10 hover:border-primary-500/50 hover:scale-105 hover:shadow-lg hover:shadow-primary-500/10` 
                      : 'bg-surface border-white/5 opacity-40 grayscale'
                  )}
                >
                  <Icon size={28} className={badge.unlocked ? badge.color : 'text-slate-600'} />
                  <span className={cn(
                    "text-[10px] mt-2 text-center leading-tight font-medium",
                    badge.unlocked ? "text-white" : "text-slate-500"
                  )}>
                    {badge.name}
                  </span>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-surface border border-white/10 rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 w-max max-w-[150px] text-center">
                    <p className={cn("font-bold text-xs mb-0.5", badge.color)}>{badge.name}</p>
                    <p className="text-[10px] text-slate-400">{badge.desc}</p>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-surface border-b border-r border-white/10"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Actions */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
            <Shield size={20} className="text-primary-400" />
            Impostazioni Account
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Indirizzo Email</p>
                  <p className="text-xs text-slate-500">{authUser?.email ?? ''}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Password</p>
                  <p className="text-xs text-slate-500">Ultima modifica 3 mesi fa</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="text-primary-400 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
              >
                Aggiorna
              </button>
            </div>

            <div className="pt-4 mt-2">
              <button 
                onClick={handleLogout}
                className="w-full py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase tracking-wider text-xs hover:bg-red-500/20 hover:border-red-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Lock size={14} />
                Esci
              </button>
            </div>
          </div>
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card p-6 w-full max-w-md border-t-4 border-t-primary-500 animate-slide-up">
              <h3 className="text-xl font-display font-bold mb-1 text-white">Cambia Password</h3>
              <p className="text-sm text-slate-400 mb-6">Inserisci la tua password attuale e quella nuova.</p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password attuale</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="input-field bg-surface"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nuova password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-field bg-surface"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label htmlFor="confirmNewPassword" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Conferma password</label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input-field bg-surface"
                    placeholder="••••••••"
                  />
                </div>
                {formError && <p className="text-sm text-red-400">{formError}</p>}
              </div>
              
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 rounded-lg bg-surface border border-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-white/5 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => void handlePasswordSave()}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-xs"
                >
                  <Save size={16} />
                  Salva Modifiche
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
