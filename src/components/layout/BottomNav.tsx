import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'HOME', icon: Home },
  { to: '/match', label: 'MATCH', icon: Calendar },
  { to: '/classifica', label: 'CLASSIFICA', icon: Trophy },
  { to: '/account', label: 'ACCOUNT', icon: User },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-night/95 backdrop-blur-xl border-t border-white/10 flex items-center md:hidden" aria-label="Navigazione principale">
      {/* First two items */}
      {navItems.slice(0, 2).map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to ||
          (item.to === '/' && location.pathname === '/dashboard');
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-150',
              isActive ? 'text-primary-400' : 'text-white/35 hover:text-white/60'
            )}
          >
            <Icon size={21} strokeWidth={isActive ? 2.5 : 1.6} />
            <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
            {isActive && <span className="w-7 h-[3px] rounded-full bg-primary-400 mt-0.5" />}
          </Link>
        );
      })}

      {/* Center GIOCA button */}
      <Link
        to="/pronostici"
        className="flex-1 flex flex-col items-center justify-center -mt-7"
        aria-label="Gioca ora, vai ai pronostici"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary-500/30 blur-md scale-110" />
          <div className="relative w-[54px] h-[54px] rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/50 border-[3px] border-night">
            {/* Pallone da calcio: sfera bianca, pentagono centrale e cuciture */}
            <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
              <circle cx="16" cy="16" r="14.5" fill="#ffffff" />
              <g stroke="#111827" strokeWidth="1.5" strokeLinecap="round">
                <path d="M16 11.8V3.5" />
                <path d="M19.9 14.7l7.9-2.6" />
                <path d="M18.4 19.3l4.9 6.7" />
                <path d="M13.6 19.3l-4.9 6.7" />
                <path d="M12.1 14.7l-7.9-2.6" />
              </g>
              <path d="M16 11.8l4 2.9-1.5 4.7h-5l-1.5-4.7z" fill="#111827" />
            </svg>
          </div>
        </div>
        <span className="text-[9px] font-black tracking-wider text-primary-400 mt-1">GIOCA</span>
      </Link>

      {/* Last two items */}
      {navItems.slice(2).map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-150',
              isActive ? 'text-primary-400' : 'text-white/35 hover:text-white/60'
            )}
          >
            <Icon size={21} strokeWidth={isActive ? 2.5 : 1.6} />
            <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
            {isActive && <span className="w-7 h-[3px] rounded-full bg-primary-400 mt-0.5" />}
          </Link>
        );
      })}
    </nav>
  );
}
