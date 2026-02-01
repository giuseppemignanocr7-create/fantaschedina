import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Trophy, Users, Target, AlertCircle } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated } = useAuthContext();
  const [authError, setAuthError] = useState<string | null>(null);
  
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
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Pulisci errori auth quando cambia modalità
  useEffect(() => {
    setAuthError(null);
    setErrors({});
    setSuccessMessage(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          setAuthError(error.message === 'Invalid login credentials' 
            ? 'Credenziali non valide' 
            : error.message);
          setIsLoading(false);
          return;
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.username);
        if (error) {
          setAuthError(error.message === 'User already registered'
            ? 'Email già registrata'
            : error.message);
          setIsLoading(false);
          return;
        }
      }
      
      setSuccessMessage(mode === 'login' ? 'Accesso effettuato!' : 'Registrazione completata! Controlla la tua email.');
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
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
    { icon: Trophy, text: '500€ di premi garantiti' },
    { icon: Users, text: 'Sfida i tuoi amici' },
    { icon: Target, text: 'Se uno vince, vincono tutti' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-stadium-gradient opacity-80" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1931&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20" />
        
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center font-display font-bold text-xl text-white shadow-lg shadow-primary-500/20 border border-white/10">
              FS
            </div>
            <span className="font-display font-bold text-2xl text-white tracking-tight uppercase italic">
              Fanta<span className="text-primary-500">Schedina</span>
            </span>
          </Link>
        </div>
        
        <div className="relative z-10 space-y-8">
          <h2 className="text-5xl font-display font-black text-white leading-none uppercase italic tracking-tight">
            Il calcio è <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">più bello insieme</span>
          </h2>
          <p className="text-slate-300 text-lg max-w-md">
            Unisciti alla community di scommettitori più appassionata. 
            Gioca, sfida gli amici e vinci montepremi garantiti.
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        <div className="absolute inset-0 bg-gradient-radial from-primary-900/10 to-transparent opacity-50" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center font-display font-bold text-xl text-white shadow-lg shadow-primary-500/20">
                FS
              </div>
              <span className="font-display font-bold text-2xl text-white tracking-tight uppercase italic">
                Fanta<span className="text-primary-500">Schedina</span>
              </span>
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
          <div className="flex rounded-xl bg-surface border border-white/5 p-1 mb-8">
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
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                    placeholder="Il tuo nome in campo"
                    className={`input-field pl-12 bg-surface ${errors.username ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.username}</p>
                )}
              </div>
            )}
            
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  placeholder="nome@esempio.com"
                  className={`input-field pl-12 bg-surface ${errors.email ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1 font-medium">{errors.email}</p>
              )}
            </div>
            
            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  placeholder="••••••••"
                  className={`input-field pl-12 pr-12 bg-surface ${errors.password ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Conferma Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    placeholder="••••••••"
                    className={`input-field pl-12 bg-surface ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 font-medium">{errors.confirmPassword}</p>
                )}
              </div>
            )}
            
            {/* Forgot Password (login only) */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                >
                  Recupera password
                </button>
              </div>
            )}
            
            {/* Terms (register only) */}
            {mode === 'register' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-surface text-primary-500 focus:ring-primary-500"
                  required
                />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed">
                  Ho letto e accetto il{' '}
                  <Link to="/regolamento" className="text-primary-400 hover:text-primary-300 font-bold">
                    Regolamento Ufficiale
                  </Link>{' '}
                  e confermo di essere maggiorenne (+18).
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
