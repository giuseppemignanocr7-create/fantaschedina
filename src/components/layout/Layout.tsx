import { lazy, Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { FocusManager } from './FocusManager';
import { SponsorBanner } from '@/components/ui/SponsorTicker';

// Fuori dal chunk principale: e' un pannello che la maggior parte delle
// sessioni non apre mai, e pesa quanto il resto dell'intestazione.
const Onboarding = lazy(() =>
  import('@/components/ui/Onboarding').then(m => ({ default: m.Onboarding }))
);

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile } = useAuthContext();
  const location = useLocation();

  // Chi ha gia' giocato una giornata non scarica nemmeno la guida: si carica
  // solo a chi non ha ancora giocato o a chi la chiede dal menu.
  const guidaDalMenu = new URLSearchParams(location.search).get('guida') === '1';
  const mostraGuida = guidaDalMenu || profile?.matchdaysPlayed === 0;

  return (
    <div className="min-h-screen bg-background">
      <FocusManager />

      {/* Guida al primo accesso: si mostra da sola solo a chi non ha ancora
          giocato, e si riapre dal menu (Come si gioca). */}
      {mostraGuida && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}

      {/* Fixed top header */}
      <MobileHeader onMenuClick={() => setDrawerOpen(true)} />

      {/* Sidebar: fixed overlay on mobile, fixed panel on desktop */}
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Page content — pushed right on desktop, padded top for header */}
      <div className="pt-14 md:pl-64">
        {/* Sponsor scrolling banner */}
        <SponsorBanner />

        <main className="min-h-[calc(100vh-3.5rem)] pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Fixed bottom nav (mobile only) */}
      <BottomNav />
    </div>
  );
}
