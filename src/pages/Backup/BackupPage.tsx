import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, X } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { demoBackupJobs, demoCustomers } from '../../data/demo';
import type { BackupJob } from '../../types';
import { cn } from '../../components/ui/cn';
import { format, formatDistanceToNow } from 'date-fns';

type JobStatus = BackupJob['status'];

const statusIcon: Record<JobStatus, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  failed:  XCircle,
  running: Clock,
  idle:    Clock,
};

const statusColor: Record<JobStatus, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  failed:  'text-red-500',
  running: 'text-sky-500',
  idle:    'text-text-muted',
};

const statusBadge: Record<JobStatus, React.ComponentProps<typeof Badge>['variant']> = {
  success: 'success',
  warning: 'warning',
  failed:  'danger',
  running: 'info',
  idle:    'default',
};

function customerName(id: string) {
  return demoCustomers.find(c => c.id === id)?.name ?? id;
}

function JobDrawer({ job, onClose }: { job: BackupJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        className="relative z-10 w-full max-w-md bg-surface-raised border-l border-border flex flex-col shadow-popover"
        role="complementary"
        aria-label="Job detail"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary truncate pr-4">{job.jobName}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="size-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            {(() => { const Icon = statusIcon[job.status]; return <Icon className={cn('size-6', statusColor[job.status])} />; })()}
            <div>
              <Badge variant={statusBadge[job.status]} className="capitalize">{job.status}</Badge>
              <p className="text-xs text-text-muted mt-0.5">
                {customerName(job.customerId)}
              </p>
            </div>
          </div>

          {job.errorMessage && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Error</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">{job.errorMessage}</p>
            </div>
          )}

          <dl className="space-y-3">
            {[
              { label: 'Data Source',  value: job.dataSource },
              { label: 'Repository',   value: job.repository },
              { label: 'Last Run',     value: format(new Date(job.lastRun), 'dd MMM yyyy HH:mm') },
              { label: 'Next Run',     value: job.nextRun ? format(new Date(job.nextRun), 'dd MMM yyyy HH:mm') : '—' },
              { label: 'Duration',     value: job.duration ? `${job.duration} min` : '—' },
              { label: 'Size',         value: job.sizeGb   ? `${job.sizeGb} GB`   : '—' },
              { label: 'Retention',    value: `${job.retentionDays} days` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd className="text-sm text-text-primary text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}

export function BackupPage() {
  const [selectedJob, setSelectedJob] = useState<BackupJob | null>(null);

  const failed   = demoBackupJobs.filter(j => j.status === 'failed').length;
  const warnings = demoBackupJobs.filter(j => j.status === 'warning').length;
  const success  = demoBackupJobs.filter(j => j.status === 'success').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Backup</h1>
        <p className="text-sm text-text-secondary mt-0.5">Veeam job overview across all customers.</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Failed',   value: failed,   color: 'text-red-500',     bg: 'bg-red-50    dark:bg-red-900/20',    icon: XCircle },
          { label: 'Warnings', value: warnings,  color: 'text-amber-500',  bg: 'bg-amber-50  dark:bg-amber-900/20',  icon: AlertTriangle },
          { label: 'Success',  value: success,   color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardBody className={cn('pt-5 flex flex-col items-center gap-1', s.bg, 'rounded-card')}>
                <Icon className={cn('size-6', s.color)} />
                <span className={cn('text-3xl font-bold tabular-nums', s.color)}>{s.value}</span>
                <span className="text-xs text-text-muted">{s.label}</span>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Jobs list */}
      <Card>
        <CardHeader title="Backup Jobs" subtitle={`${demoBackupJobs.length} jobs`} />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Status', 'Job Name', 'Customer', 'Last Run', 'Size', 'Repository', ''].map(h => (
                    <th
                      key={h}
                      className={cn(
                        'px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider',
                        (h === 'Size' || h === 'Repository') && 'hidden md:table-cell',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoBackupJobs.map(job => {
                  const Icon = statusIcon[job.status];
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-border hover:bg-primary-50/60 dark:hover:bg-primary-800/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedJob(job)}
                    >
                      <td className="px-4 py-3">
                        <Icon className={cn('size-4', statusColor[job.status])} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{job.jobName}</p>
                          <p className="text-xs text-text-muted">{job.dataSource}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">{customerName(job.customerId)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-muted">
                          {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-text-secondary">
                          {job.sizeGb ? `${job.sizeGb} GB` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-text-muted truncate max-w-[120px] block">{job.repository}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={statusBadge[job.status]} className="capitalize">{job.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Job detail drawer */}
      {selectedJob && (
        <JobDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}
