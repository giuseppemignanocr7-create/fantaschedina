import { Link } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  Target, 
  Zap, 
  Shield, 
  Gift,
  ArrowRight,
  Star,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useAppStore } from '@/store';
import { formatCurrency } from '@/lib/utils';

const features = [
  {
    icon: Users,
    title: 'Gioco Collettivo',
    description: 'Se un concorrente vince, vincono tutti! 40% al vincitore, 40% diviso tra tutti.',
  },
  {
    icon: Target,
    title: '10 Partite Serie A',
    description: 'Ogni settimana scegli il pronostico per 10 partite di Serie A con le quote che preferisci.',
  },
  {
    icon: Trophy,
    title: 'Premi Garantiti',
    description: '500€ garantiti con almeno 30 iscritti. 300€ al primo, 200€ al primo del girone di andata.',
  },
  {
    icon: Zap,
    title: 'Bonus Extra',
    description: '9 esiti corretti = +2 punti. 10 esiti corretti = +5 punti. Punteggio = quota presa!',
  },
  {
    icon: Gift,
    title: 'Premi Speciali',
    description: 'Quota Poker (20€): 4 vincenti con quota >2.00. Quota più alta (10€) ogni giornata.',
  },
  {
    icon: Shield,
    title: 'Trasparenza Totale',
    description: 'Schedine pubbliche dopo la deadline. Classifiche aggiornate entro 48 ore.',
  },
];

export function HomePage() {
  const { rankings, prizePool, currentMatchday } = useAppStore();
  const topThree = rankings.slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-20 lg:py-32 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-stadium-gradient opacity-90" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[url('https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-400 text-sm font-bold uppercase tracking-wider mb-8 animate-fade-in backdrop-blur-sm">
              <Star size={16} className="fill-current" />
              Stagione 2025-2026
            </div>

            {/* Main Title */}
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-display font-black mb-6 animate-slide-up tracking-tighter uppercase italic">
              Fanta<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Schedina</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-slate-300 font-medium mb-4 animate-slide-up max-w-2xl mx-auto text-balance">
              Il primo gioco di scommesse collettivo dove <span className="text-primary-400 font-bold">si vince insieme</span>.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-slide-up">
              <Link to="/schedina" className="btn-primary text-lg px-8 py-4 flex items-center gap-2 w-full sm:w-auto justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)]">
                Gioca Ora
                <ArrowRight size={20} />
              </Link>
              <Link to="/regolamento" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto justify-center">
                Regolamento
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mt-16 animate-fade-in">
              <div className="glass-card p-4 text-center border-t-4 border-t-accent-500">
                <p className="text-2xl sm:text-4xl font-mono font-bold text-accent-400">{formatCurrency(prizePool.totalPool)}</p>
                <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide font-bold mt-1">Montepremi</p>
              </div>
              <div className="glass-card p-4 text-center border-t-4 border-t-primary-500">
                <p className="text-2xl sm:text-4xl font-mono font-bold text-white">{rankings.length}</p>
                <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide font-bold mt-1">Tipsters</p>
              </div>
              <div className="glass-card p-4 text-center border-t-4 border-t-slate-500">
                <p className="text-2xl sm:text-4xl font-mono font-bold text-white">G{currentMatchday?.number || 18}</p>
                <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide font-bold mt-1">Giornata</p>
              </div>
              <div className="glass-card p-4 text-center border-t-4 border-t-green-500">
                <p className="text-2xl sm:text-4xl font-mono font-bold text-green-400">{formatCurrency(500)}</p>
                <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide font-bold mt-1">Garantito</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current Matchday Banner */}
      <section className="py-10 bg-surface border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-primary-900/20 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center animate-pulse-glow shadow-lg shadow-primary-500/20 transform rotate-3">
                <Clock size={32} className="text-white" />
              </div>
              <div>
                <h3 className="font-display font-bold text-2xl uppercase italic tracking-wide">Giornata {currentMatchday?.number || 18} Live</h3>
                <p className="text-primary-400 font-medium">Le quote stanno cambiando! Inserisci la tua giocata.</p>
              </div>
            </div>
            <Link to="/schedina" className="btn-primary flex items-center gap-2 w-full md:w-auto justify-center">
              Compila Schedina
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Come Funziona
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Un sistema semplice e trasparente per divertirsi tra amici con le partite di Serie A
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="glass-card p-6 card-hover group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-4 group-hover:from-primary-500/30 group-hover:to-accent-500/30 transition-colors">
                    <Icon size={24} className="text-primary-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="py-12 sm:py-20 lg:py-32 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start gap-12">
            {/* Left Content */}
            <div className="flex-1">
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
                Classifica Generale
              </h2>
              <p className="text-white/60 mb-8">
                I migliori giocatori del campionato 2025-2026. 
                300€ al primo classificato, 200€ al primo del girone di andata.
              </p>

              {/* Prize Pool Card */}
              <div className="glass-card p-6 mb-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Gift className="text-primary-400" size={20} />
                  Montepremi Attuale
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold gradient-text">{formatCurrency(prizePool.finalPool)}</p>
                    <p className="text-xs text-white/50">Premio Finale</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{formatCurrency(prizePool.weeklyPool)}</p>
                    <p className="text-xs text-white/50">Vincita Settimanale</p>
                  </div>
                </div>
              </div>

              <Link to="/classifica" className="btn-secondary inline-flex items-center gap-2">
                Vedi Classifica Completa
                <TrendingUp size={18} />
              </Link>
            </div>

            {/* Right: Top 3 */}
            <div className="flex-1 w-full">
              <div className="glass-card overflow-hidden">
                <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 px-6 py-4 border-b border-white/10">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Trophy className="text-yellow-400" size={20} />
                    Top 3 Classifica
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {topThree.map((player, index) => (
                    <div key={player.participantId} className="px-6 py-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-gray-400/20 text-gray-300' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{player.username}</p>
                        <p className="text-xs text-white/50">{player.matchdaysPlayed} giornate • {player.weeklyWins} vittorie</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg gradient-text">{player.totalPoints}</p>
                        <p className="text-xs text-white/50">punti</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="glass-card p-8 lg:p-12 gradient-border">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Pronto a Giocare?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Iscrizioni aperte fino alla 10ª giornata. 
              Quota di partecipazione: 20€ + 5€ per ogni giornata già passata.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/schedina" className="btn-primary text-lg px-8 py-4 flex items-center gap-2">
                Inizia a Giocare
                <ArrowRight size={20} />
              </Link>
            </div>
            <p className="text-xs text-white/40 mt-6 flex items-center justify-center gap-1">
              <Shield size={12} />
              Solo maggiori di 18 anni
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
