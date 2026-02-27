import { useNavigate } from 'react-router-dom';
import { ExternalLink, Eye } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useAlerts } from '../../../hooks/useAlerts';
import { useCustomers } from '../../../hooks/useCustomers';
import { cn } from '../../../components/ui/cn';
import { formatDistanceToNow } from 'date-fns';

export function CriticalAlertsCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { alerts, loading } = useAlerts(false); // unresolved only
  const { customers } = useCustomers();

  const topAlerts = [...alerts]
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 4);

  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—';

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Critical Alerts"
        subtitle={loading ? 'Loading…' : `${alerts.length} unresolved`}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/logs')} rightIcon={<ExternalLink className="size-3" />}>
            View all
          </Button>
        }
      />
      <CardBody>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : (
          <ul className="space-y-2">
            {topAlerts.length === 0 && (
              <li className="text-sm text-text-muted text-center py-4">No unresolved alerts.</li>
            )}
            {topAlerts.map(alert => (
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
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
