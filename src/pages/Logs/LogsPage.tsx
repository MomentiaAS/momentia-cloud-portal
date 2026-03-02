import { useState, useMemo } from 'react';
import { Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useLogs } from '../../hooks/useLogs';
import { useCustomers } from '../../hooks/useCustomers';
import type { Severity } from '../../types';
import { cn } from '../../components/ui/cn';
import { format } from 'date-fns';

const SEVERITIES: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low', 'info'];
const TIME_RANGES = ['All time', 'Last hour', 'Last 24h', 'Last 7 days'];

const severityDot: Record<Severity, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-sky-400',
  info:     'bg-slate-400',
};

export function LogsPage() {
  const { logs, loading, error, reload } = useLogs();
  const { customers } = useCustomers();

  const [severity,    setSeverity]    = useState<Severity | 'all'>('all');
  const [system,      setSystem]      = useState('All systems');
  const [customerId,  setCustomerId]  = useState('all');
  const [timeRange,   setTimeRange]   = useState('Last 24h');

  const allSystems = useMemo(
    () => ['All systems', ...Array.from(new Set(logs.map(l => l.system)))],
    [logs],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff: Record<string, number> = {
      'Last hour':   now - 1000 * 60 * 60,
      'Last 24h':    now - 1000 * 60 * 60 * 24,
      'Last 7 days': now - 1000 * 60 * 60 * 24 * 7,
    };
    return logs.filter(l => {
      if (severity !== 'all' && l.severity !== severity)       return false;
      if (system !== 'All systems' && l.system !== system)     return false;
      if (customerId !== 'all' && l.customerId !== customerId) return false;
      if (timeRange !== 'All time') {
        const ts = new Date(l.timestamp).getTime();
        if (ts < (cutoff[timeRange] ?? 0))                     return false;
      }
      return true;
    });
  }, [logs, severity, system, customerId, timeRange]);

  const customerName = (id?: string) => {
    if (!id) return 'Portal / System';
    return customers.find(c => c.id === id)?.name ?? id;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Logs</h1>
          <p className="text-sm text-text-secondary mt-0.5">Unified event log across all customers and integrations.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh" disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />{error}
          <Button variant="ghost" size="sm" onClick={reload} className="ml-auto">Retry</Button>
        </div>
      )}

      {loading && !error && <SkeletonCard />}

      {!loading && (
        <>
          {/* Filters */}
          <Card>
            <CardBody className="pt-4">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                <Filter className="size-3.5" />
                Filters
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Select value={severity} onChange={e => setSeverity(e.target.value as Severity | 'all')}>
                  {SEVERITIES.map(s => (
                    <option key={s} value={s}>{s === 'all' ? 'All severities' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </Select>
                <Select value={system} onChange={e => setSystem(e.target.value)}>
                  {allSystems.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="all">All customers</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select value={timeRange} onChange={e => setTimeRange(e.target.value)}>
                  {TIME_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
            </CardBody>
          </Card>

          {/* Log table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Severity', 'Timestamp', 'System', 'Customer', 'Message'].map(h => (
                      <th
                        key={h}
                        className={cn(
                          'px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider',
                          (h === 'Customer') && 'hidden md:table-cell',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-muted">
                        No log entries match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(log => (
                      <tr key={log.id} className="border-b border-border hover:bg-primary-50/60 dark:hover:bg-primary-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('size-2 rounded-full shrink-0', severityDot[log.severity])} />
                            <Badge variant={log.severity}>{log.severity}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-text-muted tabular-nums">
                            {format(new Date(log.timestamp), 'dd MMM HH:mm:ss')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-text-secondary">{log.system}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-text-muted">{customerName(log.customerId)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-text-primary">{log.message}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
