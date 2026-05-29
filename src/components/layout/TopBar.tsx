import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Bell, Menu, RefreshCw, CalendarDays, ChevronDown, LogOut, UserCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../ui/cn';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { CountBadge } from '../ui/Badge';
import { GlobalSearchBar } from './GlobalSearchBar';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../hooks/useAlerts';
import { useAllAssets } from '../../hooks/useAssets';

const READ_WARRANTY_KEY = 'momentia-read-warranty-alerts';

function readWarrantySet(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_WARRANTY_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

const DATE_RANGES = ['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Custom…'];

export function TopBar({ showDashboardExtras = false }: { showDashboardExtras?: boolean }) {
  const { theme, toggleTheme }         = useTheme();
  const { toggleSidebar } = useApp();
  const { profile, signOut }           = useAuth();
  const { alerts, reload: reloadAlerts } = useAlerts(false);
  const { assets, reload: reloadAssets } = useAllAssets();
  const navigate = useNavigate();

  const [dateRange, setDateRange]       = useState('Last 7 days');
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [refreshSpin, setRefreshSpin]   = useState(false);

  const dateRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDateDrop(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    const onNotificationsUpdated = () => {
      void reloadAlerts();
      void reloadAssets();
    };
    window.addEventListener('notifications-updated', onNotificationsUpdated);
    return () => window.removeEventListener('notifications-updated', onNotificationsUpdated);
  }, [reloadAlerts, reloadAssets]);

  function handleRefresh() {
    setRefreshSpin(true);
    setTimeout(() => setRefreshSpin(false), 800);
  }

  async function handleSignOut() {
    setShowUserMenu(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  const displayName = profile?.name ?? profile?.email ?? 'User';
  const readWarranty = readWarrantySet();
  const warrantyUnread = assets.filter(a => {
    if (a.status !== 'active') return false;
    if (!a.warrantyEnd) return false;
    const days = Math.floor((new Date(a.warrantyEnd).getTime() - Date.now()) / 86_400_000);
    if (days >= 90) return false;
    return !readWarranty.has(`warranty-${a.id}`);
  }).length;
  const notificationCount = alerts.length + warrantyUnread;

  return (
    <header
      className={cn(
        'min-h-[var(--topbar-height)] shrink-0 pt-[env(safe-area-inset-top,0px)]',
        'bg-surface-raised border-b border-border',
        'flex items-center gap-2 sm:gap-3 px-3 sm:px-4',
      )}
    >
      {/* Hamburger — visible on small screens */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </Button>

      {/* Global search — inline on md+, icon opens full-screen sheet on mobile */}
      <div className="hidden md:block flex-1 max-w-md min-w-0">
        <GlobalSearchBar />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={() => setMobileSearchOpen(true)}
        aria-label="Open search"
      >
        <Search className="size-5" />
      </Button>

      <div className="flex-1 md:flex-none" />

      {/* Dashboard extras */}
      {showDashboardExtras && (
        <>
          {/* Date range dropdown */}
          <div ref={dateRef} className="relative hidden md:block">
            <button
              onClick={() => setShowDateDrop(v => !v)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium',
                'border border-border text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40',
                'transition-colors focus-ring',
              )}
            >
              <CalendarDays className="size-3.5 shrink-0" />
              <span>{dateRange}</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>
            {showDateDrop && (
              <div className="absolute right-0 mt-1 w-44 bg-surface-raised border border-border rounded-lg shadow-popover z-20 py-1 overflow-hidden">
                {DATE_RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => { setDateRange(r); setShowDateDrop(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-primary-100 dark:hover:bg-primary-700/40',
                      r === dateRange ? 'text-accent font-medium' : 'text-text-secondary',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh">
            <RefreshCw className={cn('size-4', refreshSpin && 'animate-spin')} />
          </Button>
        </>
      )}

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/notifications')}
        aria-label={`Notifications (${notificationCount} unread)`}
        className="relative"
      >
        <Bell className="size-4" />
        {notificationCount > 0 && (
          <span className="absolute top-1 right-1 translate-x-1/2 -translate-y-1/2">
            <CountBadge count={notificationCount} />
          </span>
        )}
      </Button>

      {/* User avatar menu */}
      <div ref={userRef} className="relative">
        <button
          onClick={() => setShowUserMenu(v => !v)}
          className="flex items-center gap-2 rounded-lg p-1 hover:bg-primary-100 dark:hover:bg-primary-700/40 transition-colors focus-ring"
          aria-haspopup="true"
          aria-expanded={showUserMenu}
        >
          <Avatar name={displayName} size="sm" src={profile?.avatar_url ?? null} />
          <span className="hidden md:block text-sm font-medium text-text-primary">{displayName}</span>
          <ChevronDown className="hidden md:block size-3 text-text-muted" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 mt-1 w-56 bg-surface-raised border border-border rounded-xl shadow-popover z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
              <p className="text-xs text-text-muted truncate">{profile?.email}</p>
              {profile?.role && (
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mt-0.5">{profile.role}</p>
              )}
            </div>
            <div className="py-1">
              <button
                onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
              >
                <UserCircle className="size-3.5" />
                Profile &amp; Settings
              </button>
            </div>
            <div className="border-t border-border py-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-surface md:hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div className="flex-1 min-w-0">
              <GlobalSearchBar mobileOverlay onClose={() => setMobileSearchOpen(false)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMobileSearchOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
