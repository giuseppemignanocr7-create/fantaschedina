import { Bell, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-background/98 backdrop-blur-xl border-b border-white/5 flex items-center" role="banner">
      {/* Desktop: logo block aligned with sidebar width */}
      <div className="hidden md:flex items-center w-64 px-4 flex-shrink-0">
        <Logo badge tagline size="sm" />
      </div>

      {/* Mobile: hamburger left + centered logo */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 ml-1 text-white/60 hover:text-white transition-colors"
        aria-label="Apri menu di navigazione"
      >
        <Menu size={22} />
      </button>
      <div className="md:hidden absolute left-1/2 -translate-x-1/2">
        <Logo badge={false} size="sm" />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1 pr-3">
        <button className="relative p-2 text-white/50 hover:text-white transition-colors rounded-xl hover:bg-white/5" aria-label="Notifiche">
          <Bell size={19} />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary-500 rounded-full ring-1 ring-background" />
        </button>
        <Link to="/profilo" className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center text-xs font-black text-white hidden md:flex shadow-md hover:opacity-80 transition-opacity">
          FM
        </Link>
      </div>
    </header>
  );
}
