import { Bell, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAlerts } from '../../hooks/useAlerts';
import { useCustomers } from '../../hooks/useCustomers';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPage() {
  const { alerts, loading, error, reload, markResolved } = useAlerts(false);
  const { customers } = useCustomers();

  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          {!loading && <Badge variant="danger">{alerts.length} unread</Badge>}
        </div>
        <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh" disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}

        {!loading && alerts.length === 0 && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="size-8 text-text-muted" />
              <p className="text-sm text-text-muted">All caught up — no unresolved alerts.</p>
            </CardBody>
          </Card>
        )}

        {!loading && alerts.map(alert => (
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
      </div>
    </div>
  );
}
