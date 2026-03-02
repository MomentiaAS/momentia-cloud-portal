import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, HeadphonesIcon, ScrollText,
  DatabaseBackup, Bell, Settings, X, ChevronRight, UserCog, Wifi,
} from 'lucide-react';
import { cn } from '../ui/cn';
import { CountBadge } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label:    string;
  to:       string;
  icon:     React.ElementType;
  badge?:   number;
}

const topNav: NavItem[] = [
  { label: 'Dashboard', to: '/',          icon: LayoutDashboard },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Support',   to: '/support',   icon: HeadphonesIcon },
  { label: 'Logs',      to: '/logs',      icon: ScrollText },
  { label: 'Backup',    to: '/backup',    icon: DatabaseBackup },
];

const bottomNav: NavItem[] = [
  { label: 'Notifications', to: '/notifications', icon: Bell, badge: 4 },
  { label: 'Settings',      to: '/settings',      icon: Settings },
];

const adminNav: NavItem[] = [
  { label: 'Users',        to: '/users',        icon: UserCog },
  { label: 'UniFi Sites',  to: '/unifi-sites',  icon: Wifi    },
];

function NavItemRow({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const isActive =
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
        'focus-ring',
        isActive
          ? 'nav-pill-active'
          : 'text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40 hover:text-text-primary',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <CountBadge count={item.badge} />
      )}
      {isActive && (
        <ChevronRight className="size-3 shrink-0 text-accent opacity-60" />
      )}
    </NavLink>
  );
}

interface SidebarProps {
  /** True when rendered as a mobile drawer overlay */
  mobile?: boolean;
}

export function Sidebar({ mobile }: SidebarProps) {
  const { setSidebarOpen } = useApp();
  const { profile }        = useAuth();
  const isSuperAdmin  = profile?.role === 'superadmin';
  const canViewUsers  = profile?.role === 'superadmin' || profile?.role === 'admin';

  const handleNav = () => {
    if (mobile) setSidebarOpen(false);
  };

  return (
    <nav
      className={cn(
        'flex flex-col h-full bg-surface-raised border-r border-border',
        'w-[var(--sidebar-width)]',
      )}
    >
      {/* Logo + close button (mobile) */}
      <div className="flex items-center justify-between px-4 h-[var(--topbar-height)] border-b border-border shrink-0">
        <NavLink to="/" className="flex items-center gap-2.5 focus-ring rounded-md" aria-label="Go to dashboard">
          <img
            src="/momentia-logo-light.png"
            alt="Momentia"
            className="size-8 dark:hidden"
          />
          <img
            src="/momentia-logo-dark.png"
            alt="Momentia"
            className="size-8 hidden dark:block"
          />
          <span className="text-sm font-bold text-text-primary tracking-tight">
            Moment<span className="text-accent">ia</span> Cloud Portal
          </span>
        </NavLink>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text-primary focus-ring"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Top nav */}
      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Navigation
        </p>
        {topNav.map(item => (
          <NavItemRow key={item.to} item={item} onClick={handleNav} />
        ))}
      </div>

      {/* Admin nav — superadmin and admin */}
      {canViewUsers && (
        <div className="px-3 pb-2 pt-2 border-t border-border space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Admin
          </p>
          {adminNav.map(item => (
            <NavItemRow key={item.to} item={item} onClick={handleNav} />
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <div className="px-3 pb-4 pt-2 border-t border-border space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Account
        </p>
        {bottomNav.map(item => (
          <NavItemRow key={item.to} item={item} onClick={handleNav} />
        ))}
      </div>
    </nav>
  );
}
