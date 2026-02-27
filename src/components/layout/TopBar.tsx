import { useState, useRef, useEffect } from 'react';
import { Search, Sun, Moon, Bell, Menu, RefreshCw, CalendarDays, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../ui/cn';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CountBadge } from '../ui/Badge';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

const DATE_RANGES = ['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Custom…'];

export function TopBar({ showDashboardExtras = false }: { showDashboardExtras?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const { toggleSidebar, user, notificationCount } = useApp();
  const navigate = useNavigate();

  const [searchVal, setSearchVal] = useState('');
  const [dateRange, setDateRange]  = useState('Last 7 days');
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [refreshSpin, setRefreshSpin] = useState(false);

  const dateRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDateDrop(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchVal.trim()) navigate(`/customers?q=${encodeURIComponent(searchVal.trim())}`);
  }

  function handleRefresh() {
    setRefreshSpin(true);
    setTimeout(() => setRefreshSpin(false), 800);
  }

  return (
    <header
      className={cn(
        'h-[var(--topbar-height)] shrink-0',
        'bg-surface-raised border-b border-border',
        'flex items-center gap-3 px-4',
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

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-sm">
        <Input
          leftIcon={<Search className="size-3.5" />}
          placeholder="Search customers, sites, assets, alerts…"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          aria-label="Search"
        />
      </form>

      <div className="flex-1" />

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
        {theme === 'dark'
          ? <Sun className="size-4" />
          : <Moon className="size-4" />
        }
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
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="hidden md:block text-sm font-medium text-text-primary">{user.name}</span>
          <ChevronDown className="hidden md:block size-3 text-text-muted" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 mt-1 w-52 bg-surface-raised border border-border rounded-xl shadow-popover z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-text-primary">{user.name}</p>
              <p className="text-xs text-text-muted">{user.email}</p>
            </div>
            <div className="py-1">
              {[
                { label: 'Profile',   action: () => navigate('/settings') },
                { label: 'Settings',  action: () => navigate('/settings') },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setShowUserMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-border py-1">
              <button className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
