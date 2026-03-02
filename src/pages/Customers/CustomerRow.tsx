import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';
import type { Customer, HealthStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';

const healthBadge: Record<HealthStatus, React.ComponentProps<typeof Badge>['variant']> = {
  healthy: 'success',
  degraded: 'warning',
  critical: 'danger',
  unknown: 'default',
};

interface CustomerRowProps {
  customer:  Customer;
  onEdit:    (c: Customer) => void;
  onView:    (c: Customer) => void;
  archived?: boolean;
}

export function CustomerRow({ customer: c, onEdit, onView, archived }: CustomerRowProps) {
  const navigate   = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <tr
      className={cn(
        'border-b border-border transition-colors',
        archived
          ? 'opacity-50 hover:opacity-70'
          : 'hover:bg-primary-50/60 dark:hover:bg-primary-800/20',
      )}
    >
      {/* Name — clicking navigates to customer detail */}
      <td className="px-4 py-3">
        <button
          onClick={() => navigate(`/customers/${c.id}`)}
          className="text-left group"
        >
          <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">{c.name}</p>
          {c.domain && <p className="text-xs text-text-muted">{c.domain}</p>}
        </button>
      </td>

      {/* Health */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <Badge variant={healthBadge[c.health]} dot>
          {c.health.charAt(0).toUpperCase() + c.health.slice(1)}
        </Badge>
      </td>

      {/* Alerts */}
      <td className="px-4 py-3 hidden md:table-cell">
        {c.openAlerts > 0 ? (
          <Badge variant={c.openAlerts >= 5 ? 'danger' : 'warning'}>{c.openAlerts} open</Badge>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </td>

      {/* Tier */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-text-secondary capitalize">{c.tier}</span>
      </td>

      {/* Last sync */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-text-muted">
          {formatDistanceToNow(new Date(c.lastSync), { addSuffix: true })}
        </span>
      </td>

      {/* Assigned */}
      <td className="px-4 py-3 hidden xl:table-cell">
        <span className="text-xs text-text-secondary">{c.assignedTech}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onView(c)} aria-label="View">
            <Eye className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(c)} aria-label="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <div ref={menuRef} className="relative">
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(v => !v)} aria-label="More">
              <MoreHorizontal className="size-3.5" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-surface-raised border border-border rounded-lg shadow-popover z-10 py-1">
                <button className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40">
                  Archive
                </button>
                <button className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
