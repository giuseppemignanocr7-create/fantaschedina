import { Link } from 'react-router-dom';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar,
  Clock,
  ChevronRight,
  Zap,
  Star,
  Award,
  Flame,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAppStore } from '@/store';
import { formatCurrency } from '@/lib/utils';

export function DashboardPage() {
  const { currentUser, currentMatchday, rankings, prizePool, currentSchedina } = useAppStore();

  if (!currentUser) {
    return null;
  }

  const userRanking = rankings.find(r => r.participantId === currentUser.id);
  const userPosition = userRanking?.rank || rankings.length + 1;

  const stats = {
    totalSchedine: 17,
    correctPredictions: 112,
    totalPredictions: 170,
    winRate: 65.9,
    weeklyWins: userRanking?.weeklyWins || 0,
    bestMatchday: userRanking?.bestMatchdayPoints || 0,
    currentStreak: 3,
    perfectSchedine: userRanking?.perfectSchedine || 0,
  };

  const badges = [
    { id: 'first', name: 'Prima Schedina', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20', unlocked: true },
    { id: 'winner', name: 'Vincitore', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20', unlocked: stats.weeklyWins > 0 },
    { id: 'perfect', name: '10/10', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/20', unlocked: stats.perfectSchedine > 0 },
    { id: 'streak', name: 'Streak 5', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20', unlocked: stats.currentStreak >= 5 },
    { id: 'top3', name: 'Top 3', icon: Award, color: 'text-primary-400', bg: 'bg-primary-500/20', unlocked: userPosition <= 3 },
  ];

  const schedineRecenti = [
    { matchday: 17, points: 4.8, correct: 7, date: '25/01/2026' },
    { matchday: 16, points: 5.2, correct: 8, date: '18/01/2026' },
    { matchday: 15, points: 3.9, correct: 6, date: '11/01/2026' },
  ];

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-1">
            Ciao, <span className="gradient-text">{currentUser.username}</span>! 👋
          </h1>
          <p className="text-white/60">Ecco il riepilogo della tua attività</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass-card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={48} />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-primary-400" />
              </div>
              <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">Ranking</span>
            </div>
            <p className="text-3xl sm:text-4xl font-mono font-bold text-white">{userPosition}°</p>
            <p className="text-xs text-slate-500 font-medium mt-1">su {rankings.length} tipsters</p>
          </div>

          <div className="glass-card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap size={48} />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                <Zap size={20} className="text-accent-400" />
              </div>
              <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">Punti Totali</span>
            </div>
            <p className="text-3xl sm:text-4xl font-mono font-bold text-accent-400">{currentUser.totalPoints}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">+{currentUser.weeklyPoints} questa settimana</p>
          </div>

          <div className="glass-card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target size={48} />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Target size={20} className="text-green-400" />
              </div>
              <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">Precisione</span>
            </div>
            <p className="text-3xl sm:text-4xl font-mono font-bold text-green-400">{stats.winRate}%</p>
            <p className="text-xs text-slate-500 font-medium mt-1">{stats.correctPredictions}/{stats.totalPredictions} pronostici</p>
          </div>

          <div className="glass-card p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Trophy size={48} />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Trophy size={20} className="text-yellow-400" />
              </div>
              <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">Vittorie</span>
            </div>
            <p className="text-3xl sm:text-4xl font-mono font-bold text-yellow-400">{stats.weeklyWins}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">settimanali</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Matchday */}
            <div className="glass-card overflow-hidden border-t-4 border-t-primary-500">
              <div className="bg-surface px-4 sm:px-6 py-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center animate-pulse-glow shadow-lg shadow-primary-500/20">
                      <Calendar size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg uppercase italic tracking-wide">Giornata {currentMatchday?.number || 18}</h3>
                      <div className="flex items-center gap-2 text-primary-400 text-xs font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                        In Corso
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-accent-400 text-sm font-bold bg-accent-500/10 px-3 py-1 rounded-full border border-accent-500/20">
                    <Clock size={14} />
                    <span className="hidden sm:inline">DEADLINE VICINA</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-8">
                {currentSchedina?.isLocked ? (
                  <div className="text-center py-6">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                      <CheckCircle2 size={40} className="text-green-400" />
                    </div>
                    <h4 className="font-display font-bold text-2xl text-white mb-2">Schedina Confermata</h4>
                    <p className="text-slate-400 mb-6">
                      Hai inserito {currentSchedina.predictions?.length || 0}/10 pronostici. Buona fortuna!
                    </p>
                    <Link to="/schedina" className="text-primary-400 font-bold hover:text-primary-300 inline-flex items-center gap-2 transition-colors uppercase tracking-wide text-sm">
                      Rivedi le tue scelte <ChevronRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-20 h-20 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                      <XCircle size={40} className="text-accent-400" />
                    </div>
                    <h4 className="font-display font-bold text-2xl text-white mb-2">Azione Richiesta</h4>
                    <p className="text-slate-400 mb-6">Non hai ancora inviato la tua giocata per questa giornata.</p>
                    <Link to="/schedina" className="btn-primary inline-flex items-center gap-2">
                      Piazza la tua Schedina <ChevronRight size={18} />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Recent */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock size={18} className="text-primary-400" />
                  Ultime Schedine
                </h3>
                <Link to="/storico" className="text-sm text-primary-400 hover:underline flex items-center gap-1">
                  Tutte <ChevronRight size={16} />
                </Link>
              </div>
              
              <div className="divide-y divide-white/5">
                {schedineRecenti.map((s) => (
                  <div key={s.matchday} className="px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center font-bold text-white/60">
                        G{s.matchday}
                      </div>
                      <div>
                        <p className="font-medium">Giornata {s.matchday}</p>
                        <p className="text-xs text-white/50">{s.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold gradient-text">{s.points} pt</p>
                      <p className="text-xs text-white/50">{s.correct}/10</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="glass-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Award size={18} className="text-primary-400" />
                I tuoi Badge
              </h3>
              <div className="grid grid-cols-5 lg:grid-cols-3 gap-2">
                {badges.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div 
                      key={b.id}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 ${
                        b.unlocked ? `${b.bg} border border-white/10` : 'bg-white/5 opacity-40'
                      }`}
                      title={b.name}
                    >
                      <Icon size={20} className={b.unlocked ? b.color : 'text-white/30'} />
                      <span className="text-[9px] mt-1 text-white/60">{b.name.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
              <Link to="/profilo" className="text-sm text-primary-400 hover:underline flex items-center gap-1 mt-4 justify-center">
                Vedi profilo <ChevronRight size={16} />
              </Link>
            </div>

            {/* Prize Pool */}
            <div className="glass-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-400" />
                Montepremi
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Finale</span>
                  <span className="font-bold gradient-text">{formatCurrency(prizePool.finalPool)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Settimanale</span>
                  <span className="font-bold">{formatCurrency(prizePool.weeklyPool)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Poker</span>
                  <span className="font-bold text-accent-400">{formatCurrency(prizePool.accumulatedPoker)}</span>
                </div>
              </div>
              <Link to="/classifica" className="btn-secondary w-full text-sm py-2 mt-4 flex items-center justify-center gap-2">
                Classifica <ChevronRight size={16} />
              </Link>
            </div>

            {/* Quick Links */}
            <div className="glass-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4">Link Rapidi</h3>
              <div className="space-y-2">
                <Link to="/profilo" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <Award size={18} className="text-primary-400" />
                  <span className="text-sm">Il mio Profilo</span>
                  <ChevronRight size={16} className="ml-auto text-white/40" />
                </Link>
                <Link to="/storico" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <Clock size={18} className="text-primary-400" />
                  <span className="text-sm">Storico Schedine</span>
                  <ChevronRight size={16} className="ml-auto text-white/40" />
                </Link>
                <Link to="/regolamento" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <Star size={18} className="text-primary-400" />
                  <span className="text-sm">Regolamento</span>
                  <ChevronRight size={16} className="ml-auto text-white/40" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
