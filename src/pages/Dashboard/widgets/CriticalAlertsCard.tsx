import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Eye, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useAlerts } from '../../../hooks/useAlerts';
import { useAllAssets } from '../../../hooks/useAssets';
import { useCustomers } from '../../../hooks/useCustomers';
import { cn } from '../../../components/ui/cn';
import { formatDistanceToNow } from 'date-fns';

const WARRANTY_WARN_DAYS = 90;

function warrantyStatus(warrantyEnd?: string): 'expired' | 'soon' | null {
  if (!warrantyEnd) return null;
  const days = Math.floor((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
  if (days < 0)                  return 'expired';
  if (days < WARRANTY_WARN_DAYS) return 'soon';
  return null;
}

export function CriticalAlertsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { alerts, loading }         = useAlerts(false); // unresolved only
  const { assets, loading: aLoad }  = useAllAssets();
  const { customers }               = useCustomers();

  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—';

  // Synthetic warranty alerts
  const warrantyAlerts = useMemo(() => assets.flatMap(a => {
    const ws = warrantyStatus(a.warrantyEnd);
    if (!ws) return [];
    return [{
      id:         `warranty-${a.id}`,
      type:       'warranty' as const,
      severity:   ws === 'expired' ? 'high' as const : 'medium' as const,
      title:      ws === 'expired'
        ? `Warranty expired: ${a.name}`
        : `Warranty expiring soon: ${a.name}`,
      customerName: customerName(a.customerId),
      customerId: a.customerId,
      warrantyEnd: a.warrantyEnd!,
    }];
  }), [assets, customers]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCount = alerts.length + warrantyAlerts.length;

  const topAlerts = useMemo(() => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const sorted = [...alerts].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 4);
    // Fill remaining slots with warranty alerts
    const slots = Math.max(0, 4 - sorted.length);
    return { regular: sorted, warranty: warrantyAlerts.slice(0, slots + 2) };
  }, [alerts, warrantyAlerts]);

  const isLoading = loading || aLoad;

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Critical Alerts"
        subtitle={isLoading ? 'Loading…' : `${totalCount} issue${totalCount !== 1 ? 's' : ''}`}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/logs')} rightIcon={<ExternalLink className="size-3" />}>
            View all
          </Button>
        }
      />
      <CardBody>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : (
          <ul className="space-y-2">
            {totalCount === 0 && (
              <li className="text-sm text-text-muted text-center py-4">No unresolved alerts.</li>
            )}

            {/* Regular alerts */}
            {topAlerts.regular.map(alert => (
              <li
                key={alert.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-surface hover:bg-primary-50 dark:hover:bg-primary-800/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={alert.severity} dot>{alert.severity.toUpperCase()}</Badge>
                    <span className="text-xs text-text-muted">{customerName(alert.customerId)}</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium mt-0.5 truncate">{alert.title}</p>
                  <p className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                    {' · '}{alert.source}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label="View alert" onClick={() => navigate('/logs')}>
                  <Eye className="size-3.5" />
                </Button>
              </li>
            ))}

            {/* Warranty alerts */}
            {topAlerts.warranty.map(w => (
              <li
                key={w.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-surface hover:bg-primary-50 dark:hover:bg-primary-800/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={w.severity} dot>{w.severity.toUpperCase()}</Badge>
                    <span className="text-xs text-text-muted">{w.customerName}</span>
                  </div>
                  <p className="text-sm text-text-primary font-medium mt-0.5 truncate">{w.title}</p>
                  <p className="text-xs text-text-muted">
                    <ShieldAlert className="size-3 inline mr-1" />
                    Warranty: {w.warrantyEnd}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View asset"
                  onClick={() => navigate(`/customers/${w.customerId}`)}
                >
                  <Eye className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
