import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { FocusManager } from './FocusManager';

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <FocusManager />

      {/* Fixed top header */}
      <MobileHeader onMenuClick={() => setDrawerOpen(true)} />

      {/* Sidebar: fixed overlay on mobile, fixed panel on desktop */}
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Page content — pushed right on desktop, padded top for header */}
      <div className="pt-14 md:pl-64">
        <main className="min-h-[calc(100vh-3.5rem)] pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Fixed bottom nav (mobile only) */}
      <BottomNav />
    </div>
  );
}
