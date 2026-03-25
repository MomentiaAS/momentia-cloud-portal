import { Bell, RefreshCw, ShieldAlert, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAlerts } from '../../hooks/useAlerts';
import { useAllAssets } from '../../hooks/useAssets';
import { useCustomers } from '../../hooks/useCustomers';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { alerts, loading, error, reload, markResolved } = useAlerts(false);
  const { assets, loading: assetsLoading, error: assetsError, reload: reloadAssets } = useAllAssets();
  const { customers } = useCustomers();

  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—';
  const warrantyAlerts = assets.flatMap(a => {
    if (!a.warrantyEnd) return [];
    const days = Math.floor((new Date(a.warrantyEnd).getTime() - Date.now()) / 86_400_000);
    if (days >= 90) return [];
    return [{
      id: `warranty-${a.id}`,
      customerId: a.customerId,
      title: days < 0 ? `Warranty expired: ${a.name}` : `Warranty expiring soon: ${a.name}`,
      warrantyEnd: a.warrantyEnd,
      severity: days < 0 ? 'high' as const : 'medium' as const,
      source: 'warranty',
    }];
  });
  const isLoading = loading || assetsLoading;
  const totalUnread = alerts.length + warrantyAlerts.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          {!isLoading && <Badge variant="danger">{totalUnread} unread</Badge>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { reload(); reloadAssets(); }}
          aria-label="Refresh"
          disabled={isLoading}
        >
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {(error || assetsError) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error ?? assetsError}
        </div>
      )}

      <div className="space-y-2">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}

        {!isLoading && totalUnread === 0 && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="size-8 text-text-muted" />
              <p className="text-sm text-text-muted">All caught up — no unresolved alerts.</p>
            </CardBody>
          </Card>
        )}

        {!isLoading && alerts.map(alert => (
          <Card key={alert.id} className="hover:shadow-card-hover">
            <CardBody className="pt-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={alert.severity} dot>{alert.severity.toUpperCase()}</Badge>
                  <span className="text-xs text-text-muted">{customerName(alert.customerId)}</span>
                  <span className="text-xs text-text-muted">· {alert.source}</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">{alert.title}</p>
                <p className="text-sm text-text-secondary mt-0.5">{alert.message}</p>
                <p className="text-xs text-text-muted mt-1">
                  {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markResolved(alert.id)}
              >
                Resolve
              </Button>
            </CardBody>
          </Card>
        ))}

        {!isLoading && warrantyAlerts.map(alert => (
          <Card key={alert.id} className="hover:shadow-card-hover">
            <CardBody className="pt-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={alert.severity} dot>{alert.severity.toUpperCase()}</Badge>
                  <span className="text-xs text-text-muted">{customerName(alert.customerId)}</span>
                  <span className="text-xs text-text-muted">· {alert.source}</span>
                </div>
                <p className="text-sm font-semibold text-text-primary">{alert.title}</p>
                <p className="text-sm text-text-secondary mt-0.5">
                  <ShieldAlert className="size-3.5 inline mr-1" />
                  Warranty date: {alert.warrantyEnd}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/customers/${alert.customerId}?tab=assets`)}
                rightIcon={<ExternalLink className="size-3" />}
              >
                Open
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
