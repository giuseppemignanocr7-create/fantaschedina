import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Target, Trophy, BarChart2, Gamepad2, Flag, Gift, User,
  X, TrendingUp, Calendar, FileText, LogOut, Zap, ShoppingBag, ClipboardList,
  Radio, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Logo } from './Logo';
import { useAuthContext } from '@/contexts/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navLinks = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/pronostici', label: 'Pronostici', icon: Target },
  { to: '/fantaschedine', label: 'Le mie fantaschedine', icon: ClipboardList },
  { to: '/leghe', label: 'Leghe', icon: Trophy },
  { to: '/classifica', label: 'Classifiche', icon: TrendingUp },
  { to: '/live', label: 'Live', icon: Radio },
  { to: '/minigiochi', label: 'Minigiochi', icon: Gamepad2 },
  { to: '/missioni', label: 'Missioni', icon: Flag },
  { to: '/premi', label: 'Premi', icon: Gift },
  { to: '/negozio', label: 'Negozio', icon: ShoppingBag, badge: 'PRESTO' },
  { to: '/calendario', label: 'Calendario', icon: Calendar },
  { to: '/statistiche', label: 'Statistiche', icon: BarChart2 },
  { to: '/profilo', label: 'Profilo', icon: User },
  { to: '/regolamento', label: 'Regolamento', icon: FileText },
];

const adminLinks = [
  { to: '/admin', label: 'Admin', icon: Zap },
];

function NavLink({ to, label, icon: Icon, badge, onClick }: { to: string; label: string; icon: LucideIcon; badge?: string; onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to ||
    (to === '/' && location.pathname === '/dashboard') ||
    (to !== '/' && location.pathname.startsWith(to + '/'));
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm',
        isActive
          ? 'bg-primary-500/15 text-primary-400 font-bold shadow-[inset_2px_0_0_#84d80c]'
          : 'text-white/55 hover:text-white hover:bg-white/5 font-medium'
      )}
    >
      <Icon
        size={17}
        strokeWidth={isActive ? 2.5 : 1.8}
        className={isActive ? 'text-primary-400' : 'text-white/40 group-hover:text-white/70 transition-colors'}
      />
      {label}
      {badge && (
        <span className="ml-auto rounded border border-white/10 bg-white/8 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white/45">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { currentUser } = useAppStore();
  const { signOut } = useAuthContext();
  const navigate = useNavigate();
  const userInitials = currentUser?.username?.slice(0, 2).toUpperCase() ?? 'FM';
  const userPoints = currentUser?.totalPoints ?? 0;
  const userRank = currentUser?.rank ?? '—';

  const handleLogout = async () => {
    await signOut();
    onClose?.();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar panel - always fixed, desktop always visible below header */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-background border-r border-white/8 flex flex-col transition-transform duration-300',
          'md:top-14 md:h-[calc(100%-3.5rem)] md:z-30 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Mobile close button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3.5 border-b border-white/5">
          <Logo badge tagline size="sm" />
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors" aria-label="Chiudi menu">
            <X size={18} />
          </button>
        </div>

        {/* Profile card */}
        <div className="px-4 py-4 border-b border-white/5 flex-shrink-0">
          {/* Avatar row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-shrink-0">
              <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center font-display font-black text-xl text-white shadow-lg shadow-primary-500/25 ring-2 ring-primary-500/20">
                {userInitials}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-display font-black text-[13px] text-white tracking-tight truncate">
                  {currentUser?.username ?? 'Ospite'}
                </span>
                {currentUser && (
                  <span className="text-[8px] font-black bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded border border-primary-500/30 uppercase tracking-wide flex-shrink-0">PRO</span>
                )}
              </div>
              <p className="text-[10px] text-white/40">
                {currentUser ? `${currentUser.paidWeeks} settimane pagate` : 'Non autenticato'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 border border-white/8 rounded-xl p-2.5 text-center">
              <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">PUNTI TOTALI</p>
              <p className="font-black text-primary-400 text-[20px] leading-none">{userPoints.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl p-2.5 text-center">
              <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">POSIZIONE</p>
              <p className="font-black text-white text-[22px] leading-none">#{userRank}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto scrollbar-hide" aria-label="Navigazione principale">
          {navLinks.map((link) => (
            <NavLink key={link.to} {...link} onClick={onClose} />
          ))}
          {currentUser?.role === 'admin' && (
            <>
              <div className="my-2 border-t border-white/5" />
              {adminLinks.map((link) => (
                <NavLink key={link.to} {...link} onClick={onClose} />
              ))}
            </>
          )}
        </nav>

        {/* Promo card */}
        <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-2">
          <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-[#0c2a14] via-[#0a2010] to-[#061508] border border-primary-500/25">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary-500/40 via-primary-400/20 to-transparent" />
            <p className="text-[11px] font-black text-primary-300 uppercase tracking-wide leading-snug mb-1">
              GIOCA, VINCI,<br />SALI IN CLASSIFICA!
            </p>
            <p className="text-[10px] text-white/45 leading-relaxed pr-8">
              Ogni pronostico può farti guadagnare tanti punti!
            </p>
            <div className="absolute bottom-2 right-2 text-[28px] opacity-25 select-none">🌐</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white/55 hover:text-red-300 hover:bg-red-500/10 transition-all"
            aria-label="Esci dal tuo account"
          >
            <LogOut size={16} strokeWidth={1.8} />
            Esci
          </button>
        </div>
      </aside>
    </>
  );
}
