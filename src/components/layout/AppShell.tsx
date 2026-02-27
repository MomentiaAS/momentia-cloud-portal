import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../ui/cn';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useApp } from '../../context/AppContext';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, setSidebarOpen } = useApp();
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname, setSidebarOpen]);

  const isDashboard = location.pathname === '/';

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile />
          </div>
        </>
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar showDashboardExtras={isDashboard} />

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 overflow-y-auto',
            'px-4 sm:px-6 lg:px-8 py-6',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
