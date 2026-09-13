import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { NotificationsPanel, useCasella } from '@/components/ui/NotificationsPanel';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { notifiche, nonLette } = useCasella();
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-night/95 backdrop-blur-xl border-b border-white/5 flex items-center" role="banner">
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
          {/* La campanella apre la casella: badge con le non lette, che sono
              le stesse notifiche arrivate come push. */}
          <button
            type="button"
            onClick={() => setAperto(a => !a)}
            className="relative p-2 text-white/50 hover:text-white transition-colors rounded-xl hover:bg-white/5"
            aria-label={nonLette > 0 ? `Notifiche, ${nonLette} non lette` : 'Notifiche'}
            aria-expanded={aperto}
          >
            <Bell size={19} />
            {nonLette > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-night text-[10px] font-black flex items-center justify-center ring-2 ring-night">
                {nonLette > 9 ? '9+' : nonLette}
              </span>
            )}
          </button>
          <Link to="/profilo" className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center text-xs font-black text-white hidden md:flex shadow-md hover:opacity-80 transition-opacity">
            FM
          </Link>
        </div>
      </header>
      <NotificationsPanel aperto={aperto} onClose={() => setAperto(false)} notifiche={notifiche} />
    </>
  );
}
