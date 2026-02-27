import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { useCustomers } from '../../../hooks/useCustomers';
import { cn } from '../../../components/ui/cn';

export function EnvironmentStatusCard({ className }: { className?: string }) {
  const { customers, loading } = useCustomers();
  const active   = customers.filter(c => c.status === 'active');
  const healthy  = active.filter(c => c.health === 'healthy').length;
  const degraded = active.filter(c => c.health === 'degraded').length;
  const critical = active.filter(c => c.health === 'critical').length;

  const stats = [
    { label: 'Healthy',  value: healthy,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
    { label: 'Degraded', value: degraded, color: 'text-amber-500',   bg: 'bg-amber-50   dark:bg-amber-900/20',   icon: AlertTriangle },
    { label: 'Critical', value: critical, color: 'text-red-500',     bg: 'bg-red-50     dark:bg-red-900/20',     icon: XCircle },
  ];

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Environment Status"
        subtitle={loading ? 'Loading…' : `${active.length} active customers`}
      />
      <CardBody>
        <div className="grid grid-cols-3 gap-3">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={cn('rounded-lg p-3 flex flex-col items-center gap-1', s.bg)}>
                <Icon className={cn('size-5', s.color)} />
                <span className={cn('text-2xl font-bold tabular-nums', s.color)}>
                  {loading ? '–' : s.value}
                </span>
                <span className="text-xs text-text-muted">{s.label}</span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
