import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Trophy, Users, Target, AlertCircle } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { burstConfetti, sideCannons } from '@/lib/juice';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const navigate = useNavigate();
  // Pagina da cui si e' stati rimandati al login (ProtectedRoute): tipicamente
  // un link d'invito a una lega. Si torna li', non sulla home.
  const location = useLocation();
  const destinazione = (() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  })();
  const { signIn, signUp, signInWithGoogle, isAuthenticated } = useAuthContext();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect se già autenticato
  useEffect(() => {
    if (isAuthenticated) {
      navigate(destinazione, { replace: true });
    }
  }, [isAuthenticated, navigate, destinazione]);

  // Pulisci errori auth quando cambia modalità
  useEffect(() => {
    const t = setTimeout(() => {
      setAuthError(null);
      setErrors({});
      setSuccessMessage(null);
    }, 0);
    return () => clearTimeout(t);
  }, [mode]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email richiesta';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email non valida';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password richiesta';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Minimo 6 caratteri';
    }
    
    if (mode === 'register') {
      if (!formData.username) {
        newErrors.username = 'Username richiesto';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Minimo 3 caratteri';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = 'Solo lettere, numeri e underscore';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Le password non coincidono';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Un solo pulsante per entrare e per iscriversi: Firebase crea l'account al
  // primo accesso con Google e ritrova lo stesso account dalle volte dopo.
  const handleGoogle = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setAuthError(error.message);
      setIsGoogleLoading(false);
      return;
    }
    setSuccessMessage('Accesso effettuato!');
    burstConfetti();
    setTimeout(() => {
      navigate(destinazione, { replace: true });
    }, 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // I messaggi arrivano gia' in italiano da useFirebaseAuth (mapFirebaseError).
      const { error } =
        mode === 'login'
          ? await signIn(formData.email, formData.password)
          : await signUp(formData.email, formData.password, formData.username);
      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }
      
      // Nessuna email di conferma parte alla registrazione: non si dice di controllarla.
      setSuccessMessage(mode === 'login' ? 'Accesso effettuato!' : 'Registrazione completata!');
      if (mode === 'register') sideCannons();
      else burstConfetti();
      setTimeout(() => {
        navigate(destinazione, { replace: true });
      }, 1000);
    } catch {
      setAuthError('Errore di connessione. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const features = [
    { icon: Trophy, text: 'Premi di giornata per il podio' },
    { icon: Users, text: 'Sfida i tuoi amici' },
    { icon: Target, text: 'Se uno vince, vincono tutti' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-night-surface relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-stadium-gradient opacity-80" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1931&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20" />
        
        <div className="relative z-10">
          <Link to="/">
            <img src="/logo-full.png" alt="FantaSchedina" width={238} height={64} className="h-16 w-auto" />
            <p className="text-[10px] text-white/35 tracking-[0.3em] uppercase mt-2 ml-1">
              PREDICI. SFIDA. VINCI.
            </p>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-5xl font-display font-black text-white leading-none uppercase italic tracking-tight">
            Il calcio è <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">più bello insieme</span>
          </h2>
          <p className="text-slate-300 text-lg max-w-md">
            Unisciti alla community di pronosticatori più appassionata. 
            Gioca, sfida gli amici e scala le classifiche!
          </p>
          
          <div className="space-y-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary-500/20 group-hover:border-primary-500/30 transition-colors">
                    <Icon className="text-white group-hover:text-primary-400 transition-colors" size={24} />
                  </div>
                  <span className="text-white font-medium text-lg">{feature.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="relative z-10">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">
            © 2025 Fantaschedina. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-night relative">
        <div className="absolute inset-0 bg-gradient-radial from-primary-900/10 to-transparent opacity-50" />
        
        <div className="w-full max-w-md relative z-10 animate-slide-up">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Link to="/">
              <img src="/logo-full.png" alt="FantaSchedina" width={148} height={40} className="h-10 w-auto" />
            </Link>
          </div>
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold mb-2 text-white">
              {mode === 'login' ? 'Bentornato Bomber!' : 'Crea il tuo profilo'}
            </h1>
            <p className="text-slate-400">
              {mode === 'login' 
                ? 'Inserisci le tue credenziali per scendere in campo' 
                : 'Registrati e ricevi subito il bonus di benvenuto'
              }
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex rounded-xl bg-night-surface border border-white/5 p-1 mb-8">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                mode === 'login'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                mode === 'register'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              Registrati
            </button>
          </div>
          
          {/* Auth Error / Success Message */}
          {authError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 animate-shake">
              <AlertCircle className="text-red-400 shrink-0" size={20} />
              <p className="text-red-400 text-sm font-medium">{authError}</p>
            </div>
          )}
          
          {successMessage && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
              <Trophy className="text-green-400 shrink-0" size={20} />
              <p className="text-green-400 text-sm font-medium">{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username (register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="username" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                    placeholder="Es. Bomber_10"
                    className={`night-input pl-12 bg-night-surface placeholder:text-slate-400 ${errors.username ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.username}</p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  placeholder="La tua email"
                  autoComplete="email"
                  className={`night-input pl-12 bg-night-surface placeholder:text-slate-400 ${errors.email ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1 font-medium">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  placeholder="••••••••"
                  className={`night-input pl-12 pr-12 bg-night-surface ${errors.password ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1 font-medium">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Conferma Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    placeholder="••••••••"
                    className={`night-input pl-12 bg-night-surface ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.confirmPassword}</p>
                )}
              </div>
            )}
            
            {/* Terms (register only) */}
            {mode === 'register' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-night-surface text-primary-500 focus:ring-primary-500"
                  required
                />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed">
                  Ho letto e accetto il{' '}
                  <Link to="/regolamento" className="text-primary-400 hover:text-primary-300 font-bold">
                    Regolamento Ufficiale
                  </Link>{' '}
                  e l'{' '}
                  <Link to="/privacy" className="text-primary-400 hover:text-primary-300 font-bold">
                    Informativa Privacy
                  </Link>
                  , e confermo di essere maggiorenne (+18).
                </label>
              </div>
            )}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entra in Campo' : 'Crea Account'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Google */}
          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] uppercase tracking-widest text-slate-500">oppure</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-slate-900 font-bold text-sm border border-white/80 hover:bg-slate-100 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.2z"/>
                  <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
                </svg>
                {mode === 'login' ? 'Entra con Google' : 'Iscriviti con Google'}
              </>
            )}
          </button>
          {mode === 'register' && (
            <p className="text-[11px] text-slate-500 leading-relaxed text-center mt-3">
              Continuando con Google accetti il{' '}
              <Link to="/regolamento" className="text-primary-400 font-bold">Regolamento</Link> e l&apos;
              <Link to="/privacy" className="text-primary-400 font-bold">Informativa Privacy</Link>, e confermi di essere maggiorenne (+18).
            </p>
          )}

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-8">
            {mode === 'login' ? (
              <>
                Nuovo giocatore?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-primary-400 hover:text-primary-300 font-bold"
                >
                  Iscriviti ora
                </button>
              </>
            ) : (
              <>
                Hai già un profilo?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary-400 hover:text-primary-300 font-bold"
                >
                  Accedi
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
