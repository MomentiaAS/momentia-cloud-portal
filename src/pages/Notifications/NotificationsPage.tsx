import { Bell } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { demoAlerts, demoCustomers } from '../../data/demo';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPage() {
  const unresolved = demoAlerts.filter(a => !a.resolved);
  const customerName = (id: string) => demoCustomers.find(c => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
        <Badge variant="danger">{unresolved.length} unread</Badge>
      </div>

      <div className="space-y-2">
        {unresolved.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="size-8 text-text-muted" />
              <p className="text-sm text-text-muted">All caught up — no unresolved alerts.</p>
            </CardBody>
          </Card>
        ) : (
          unresolved.map(alert => (
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
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
