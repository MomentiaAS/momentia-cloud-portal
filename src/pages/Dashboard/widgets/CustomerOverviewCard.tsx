import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useCustomers } from '../../../hooks/useCustomers';
import { cn } from '../../../components/ui/cn';

export function CustomerOverviewCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { customers, loading } = useCustomers();

  const active    = customers.filter(c => c.status === 'active').length;
  const potential = customers.filter(c => c.status === 'potential').length;
  const archived  = customers.filter(c => c.status === 'archived').length;
  const total     = customers.length || 1; // avoid divide-by-zero during load

  const bars = [
    { label: 'Active',    value: active,    color: 'bg-emerald-500' },
    { label: 'Potential', value: potential, color: 'bg-accent' },
    { label: 'Archived',  value: archived,  color: 'bg-primary-300 dark:bg-primary-600' },
  ];

  return (
    <Card className={cn(className)}>
      <CardHeader
        title="Customer Overview"
        subtitle={loading ? 'Loading…' : `${customers.length} total`}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
            Manage
          </Button>
        }
      />
      <CardBody>
        <div className="space-y-3">
          {bars.map(b => (
            <div key={b.label}>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-text-secondary">{b.label}</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {loading ? '–' : b.value}
                </span>
              </div>
              <div className="h-2 rounded-full bg-primary-100 dark:bg-primary-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', b.color)}
                  style={{ width: loading ? '0%' : `${Math.round((b.value / total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
