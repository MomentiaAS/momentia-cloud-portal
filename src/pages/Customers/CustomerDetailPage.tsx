import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, RefreshCw, AlertCircle,
  CheckCircle2, AlertTriangle, XCircle, Clock,
  Shield, Wrench, Eye,
  Mail, Phone, User as UserIcon,
  Server, Cloud, HardDrive, Globe, ShieldCheck,
  X, ChevronRight, Wifi, WifiOff, Users as UsersIcon,
  Laptop, Printer, Smartphone, Network, Package, Plus, Trash2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../components/ui/cn';
import { useCustomerDetail } from '../../hooks/useCustomerDetail';
import { useCustomers } from '../../hooks/useCustomers';
import { useUnifiStatus } from '../../hooks/useUnifiStatus';
import { useCustomerAssets } from '../../hooks/useAssets';
import { updateCustomer } from '../../lib/db';
import { CustomerForm } from './CustomerForm';
import { AssetForm } from '../Assets/AssetForm';
import type { Customer, Alert, BackupJob, LogEntry, Asset } from '../../types';
import type { HealthStatus, Severity } from '../../types';
import type { UserRole } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const healthVariant: Record<HealthStatus, React.ComponentProps<typeof Badge>['variant']> = {
  healthy: 'success', degraded: 'warning', critical: 'danger', unknown: 'default',
};

const severityVariant: Record<Severity, React.ComponentProps<typeof Badge>['variant']> = {
  critical: 'danger', high: 'danger', medium: 'warning', low: 'info', info: 'default',
};

const jobStatusIcon: Record<BackupJob['status'], React.ElementType> = {
  success: CheckCircle2, warning: AlertTriangle, failed: XCircle, running: Clock, idle: Clock,
};

const jobStatusColor: Record<BackupJob['status'], string> = {
  success: 'text-emerald-500', warning: 'text-amber-500',
  failed: 'text-red-500', running: 'text-sky-500', idle: 'text-text-muted',
};

const jobStatusBadge: Record<BackupJob['status'], React.ComponentProps<typeof Badge>['variant']> = {
  success: 'success', warning: 'warning', failed: 'danger', running: 'info', idle: 'default',
};

const roleColor: Record<UserRole, string> = {
  superadmin: 'text-accent', admin: 'text-blue-500',
  technician: 'text-emerald-500', viewer: 'text-text-muted',
};

const roleIcon: Record<UserRole, React.ElementType> = {
  superadmin: Shield, admin: Shield, technician: Wrench, viewer: Eye,
};

const INTEGRATION_META: Array<{
  key: keyof Customer['integrations'];
  label: string;
  icon: React.ElementType;
}> = [
  { key: 'veeam',       label: 'Veeam B&R',    icon: HardDrive  },
  { key: 'rmm',         label: 'RMM',           icon: Server     },
  { key: 'm365',        label: 'Microsoft 365', icon: Cloud      },
  { key: 'azure',       label: 'Azure',         icon: Globe      },
  { key: 'sentinelOne', label: 'SentinelOne',   icon: ShieldCheck },
  { key: 'unifi',       label: 'UniFi Network', icon: Wifi        },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col gap-1 rounded-xl border px-4 py-3',
      accent ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface',
    )}>
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{label}</p>
      <p className={cn('text-2xl font-bold', accent ? 'text-accent' : 'text-text-primary')}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function ContactCard({ title, contact }: { title: string; contact?: { name?: string; email?: string; phone?: string; role?: string } }) {
  if (!contact || (!contact.name && !contact.email)) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</p>
      <div className="space-y-1.5">
        {contact.name  && (
          <div className="flex items-center gap-2 text-sm text-text-primary">
            <UserIcon className="size-3.5 text-text-muted shrink-0" />
            <span>{contact.name}{contact.role ? <span className="text-text-muted ml-1">· {contact.role}</span> : null}</span>
          </div>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-accent hover:underline">
            <Mail className="size-3.5 shrink-0" />{contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
            <Phone className="size-3.5 shrink-0" />{contact.phone}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Tab: Assets ───────────────────────────────────────────────────────────────

const ASSET_TYPE_ICON: Record<string, React.ElementType> = {
  computer: Laptop, server: Server, network: Network,
  mobile: Smartphone, printer: Printer, license: Package, other: Package,
};

const WARRANTY_WARN_DAYS = 90;

function warrantyStatus(warrantyEnd?: string): 'expired' | 'soon' | 'ok' | null {
  if (!warrantyEnd) return null;
  const days = Math.floor((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
  if (days < 0)                      return 'expired';
  if (days < WARRANTY_WARN_DAYS)     return 'soon';
  return 'ok';
}

function AssetsTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const { assets, loading, error, addAsset, editAsset, removeAsset } = useCustomerAssets(customerId);
  const [formOpen,  setFormOpen]  = useState(false);
  const [editing,   setEditing]   = useState<Asset | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDelete(id: string) {
    setDeleteBusy(true);
    try { await removeAsset(id); } finally { setDeleteBusy(false); setDeleteId(null); }
  }

  if (loading) return (
    <div className="p-4 space-y-2 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
    </div>
  );

  if (error) return (
    <div className="p-4 flex items-center gap-2 text-sm text-red-500">
      <AlertCircle className="size-4 shrink-0" />{error}
    </div>
  );

  return (
    <>
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <p className="text-sm text-text-muted">{assets.length} asset{assets.length !== 1 ? 's' : ''}</p>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          >
            <Plus className="size-3.5" /> Add Asset
          </button>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="py-10 text-center text-sm text-text-muted">
          No assets recorded for this customer.
          {canEdit && (
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="block mx-auto mt-2 text-accent hover:underline text-xs">
              Add the first asset
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {assets.map(asset => {
            const Icon = ASSET_TYPE_ICON[asset.type] ?? Package;
            const ws   = warrantyStatus(asset.warrantyEnd);
            return (
              <div key={asset.id} className="flex items-start gap-3 px-4 py-3">
                <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="size-4 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary">{asset.name}</p>
                    <span className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                      asset.status === 'active'  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                      asset.status === 'spare'   ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                                   'bg-surface text-text-muted border border-border',
                    )}>{asset.status}</span>
                    {ws === 'expired' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Warranty expired</span>}
                    {ws === 'soon'    && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Warranty expiring soon</span>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {[asset.make, asset.model].filter(Boolean).join(' ')}
                    {asset.serial && <span className="ml-1 font-mono">· {asset.serial}</span>}
                    {asset.assignedTo && <span> · {asset.assignedTo}</span>}
                  </p>
                  {(asset.os || asset.warrantyEnd || asset.purchaseDate) && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {asset.os && <span>{asset.os}</span>}
                      {asset.warrantyEnd && <span className={cn('ml-2', ws === 'expired' ? 'text-red-500' : ws === 'soon' ? 'text-amber-500' : '')}>· Warranty: {asset.warrantyEnd}</span>}
                      {asset.purchaseDate && <span className="ml-2">· Purchased: {asset.purchaseDate}</span>}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditing(asset); setFormOpen(true); }} className="p-1 rounded text-text-muted hover:text-accent transition-colors">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(asset.id)} className="p-1 rounded text-text-muted hover:text-red-500 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm bg-surface-raised border border-border rounded-card shadow-modal p-6 space-y-4">
            <p className="text-sm font-semibold text-text-primary">Remove this asset?</p>
            <p className="text-xs text-text-muted">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} disabled={deleteBusy} className="px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:text-text-primary">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleteBusy} className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600">
                {deleteBusy ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AssetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSave={async p => { editing ? await editAsset(editing.id, p) : await addAsset(p); }}
      />
    </>
  );
}

// ── Tab: Alerts ───────────────────────────────────────────────────────────────

function AlertsTab({ alerts }: { alerts: Alert[] }) {
  const open = alerts.filter(a => !a.resolved);
  const resolved = alerts.filter(a => a.resolved);

  if (alerts.length === 0) return (
    <div className="py-10 text-center text-sm text-text-muted">No alerts recorded for this customer.</div>
  );

  return (
    <div className="divide-y divide-border">
      {[...open, ...resolved].map(alert => (
        <div key={alert.id} className={cn('flex items-start gap-3 px-4 py-3', alert.resolved && 'opacity-50')}>
          <AlertCircle className={cn('size-4 mt-0.5 shrink-0', alert.resolved ? 'text-text-muted' : severityVariant[alert.severity] === 'danger' ? 'text-red-500' : 'text-amber-500')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-text-primary">{alert.title}</p>
              <Badge variant={severityVariant[alert.severity]} className="capitalize">{alert.severity}</Badge>
              {alert.resolved && <Badge variant="default">Resolved</Badge>}
            </div>
            {alert.message && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{alert.message}</p>}
            <p className="text-xs text-text-muted mt-1">{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}{alert.source ? ` · ${alert.source}` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Logs ─────────────────────────────────────────────────────────────────

function LogsTab({ logs }: { logs: LogEntry[] }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()) || l.system.toLowerCase().includes(search.toLowerCase()))
    : logs;

  if (logs.length === 0) return (
    <div className="py-10 text-center text-sm text-text-muted">No log entries for this customer.</div>
  );

  return (
    <div className="space-y-0">
      <div className="px-4 py-3 border-b border-border">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter logs…"
          className="h-8 w-full max-w-xs rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </div>
      <div className="divide-y divide-border font-mono text-xs">
        {filtered.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-primary-50/40 dark:hover:bg-primary-800/20">
            <span className="text-text-muted shrink-0 pt-px w-32 truncate" title={log.timestamp}>
              {format(new Date(log.timestamp), 'MM-dd HH:mm:ss')}
            </span>
            <Badge variant={severityVariant[log.severity]} className="capitalize shrink-0 mt-px">{log.severity}</Badge>
            <span className="text-text-muted shrink-0 w-28 truncate" title={log.system}>{log.system}</span>
            <span className="text-text-primary break-all">{log.message}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-text-muted">No matching log entries.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Backup Jobs ──────────────────────────────────────────────────────────

function BackupTab({ jobs }: { jobs: BackupJob[] }) {
  const [selected, setSelected] = useState<BackupJob | null>(null);

  if (jobs.length === 0) return (
    <div className="py-10 text-center text-sm text-text-muted">No backup jobs configured for this customer.</div>
  );

  return (
    <>
      <div className="divide-y divide-border">
        {jobs.map(job => {
          const Icon = jobStatusIcon[job.status];
          return (
            <button
              key={job.id}
              onClick={() => setSelected(job)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-50/40 dark:hover:bg-primary-800/20 transition-colors"
            >
              <Icon className={cn('size-4 shrink-0', jobStatusColor[job.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{job.jobName}</p>
                <p className="text-xs text-text-muted">{job.dataSource}{job.repository ? ` → ${job.repository}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant={jobStatusBadge[job.status]} className="capitalize">{job.status}</Badge>
                <p className="text-xs text-text-muted mt-1">{formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}</p>
              </div>
              <ChevronRight className="size-3.5 text-text-muted shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Job detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <aside className="relative z-10 w-full max-w-md bg-surface-raised border-l border-border flex flex-col shadow-popover">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary truncate pr-4">{selected.jobName}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex items-center gap-3">
                {(() => { const Icon = jobStatusIcon[selected.status]; return <Icon className={cn('size-6', jobStatusColor[selected.status])} />; })()}
                <Badge variant={jobStatusBadge[selected.status]} className="capitalize text-sm">{selected.status}</Badge>
              </div>
              {selected.errorMessage && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {selected.errorMessage}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ['Data source',  selected.dataSource],
                  ['Repository',   selected.repository],
                  ['Last run',     format(new Date(selected.lastRun), 'PPp')],
                  ['Next run',     selected.nextRun ? format(new Date(selected.nextRun), 'PPp') : '—'],
                  ['Duration',     selected.duration != null ? `${selected.duration} min` : '—'],
                  ['Size',         selected.sizeGb   != null ? `${selected.sizeGb} GB`   : '—'],
                  ['Retention',    `${selected.retentionDays} days`],
                ].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-xs text-text-muted font-medium">{label}</dt>
                    <dd className="text-text-primary mt-0.5">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ── Network Tab ───────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={cn('text-sm font-semibold mt-0.5', accent ? 'text-accent' : 'text-text-primary')}>
        {value}
      </p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/** Derive a HealthStatus from live UniFi data. */
function computeUnifiHealth(status: import('../../hooks/useUnifiStatus').UnifiStatus): HealthStatus {
  const rs     = status.host?.reportedState;
  const counts = status.site?.statistics?.counts;
  const wanUp  = status.site?.statistics?.percentages?.wanUptime ?? 100;

  if (!status.host || rs?.state !== 'connected') return 'critical';
  if ((counts?.offlineDevice ?? 0) > 0 || wanUp < 99) return 'degraded';
  return 'healthy';
}

function NetworkTab({ siteId, customerId, onHealthChange }: {
  siteId?: string;
  customerId: string;
  onHealthChange?: (h: HealthStatus) => void;
}) {
  const { status, loading, error, reload } = useUnifiStatus(siteId);

  // After the first successful fetch, compute health and persist it.
  const savedRef = useRef(false);
  useEffect(() => {
    if (!status || savedRef.current) return;
    savedRef.current = true;
    const health = computeUnifiHealth(status);
    onHealthChange?.(health);
    // Fire-and-forget — we don't surface errors here to avoid noisy UI
    updateCustomer(customerId, { health }).catch(console.error);
  }, [status, customerId, onHealthChange]);

  if (!siteId) {
    return (
      <div className="px-4 py-10 flex flex-col items-center gap-3 text-center">
        <WifiOff className="size-8 text-text-muted" />
        <p className="text-sm font-medium text-text-primary">No UniFi Site configured</p>
        <p className="text-xs text-text-muted max-w-xs">
          Edit this customer and enable the <strong>UniFi Network</strong> integration, then enter the
          Site ID. You can discover site IDs from the UniFi Sites page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-7 text-red-500" />
        <p className="text-sm font-medium text-text-primary">Failed to load network data</p>
        <p className="text-xs text-text-muted max-w-xs">{error}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw className="size-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  // Field paths verified against actual api.ui.com response
  const site     = status?.site ?? null;
  const host     = status?.host ?? null;
  const rs       = host?.reportedState;
  const stats    = site?.statistics;
  const counts   = stats?.counts;
  const isOnline = rs?.state === 'connected';

  const deviceName  = rs?.name ?? rs?.hostname ?? 'UniFi Gateway';
  const deviceModel = rs?.hardware?.name ?? rs?.hardware?.shortname ?? '';
  const fwVersion   = rs?.version ?? '—';

  const wanIp    = stats?.wans?.WAN?.externalIp ?? rs?.ip ?? '—';
  const isp      = stats?.ispInfo?.name ?? '—';
  const wanUp    = stats?.percentages?.wanUptime;

  const latestIssue = stats?.internetIssues?.[0];
  const latency     = latestIssue?.latencyAvgMs;
  const highLat     = latestIssue?.highLatency;

  const totalDevices   = counts?.totalDevice ?? null;
  const offlineDevices = counts?.offlineDevice ?? 0;
  const onlineDevices  = totalDevices != null ? totalDevices - offlineDevices : null;
  const wiredClients   = counts?.wiredClient ?? null;
  const wifiClients    = counts?.wifiClient  ?? null;
  const totalClients   = (wiredClients != null && wifiClients != null)
    ? wiredClients + wifiClients : null;

  return (
    <div className="p-4 space-y-4">

      {/* Device status header */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-3">
          {isOnline
            ? <Wifi    className="size-5 text-emerald-500" />
            : <WifiOff className="size-5 text-red-500" />
          }
          <div>
            <p className="text-sm font-semibold text-text-primary">{deviceName}</p>
            <p className="text-xs text-text-muted">
              {deviceModel && <span>{deviceModel} · </span>}fw {fwVersion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full',
            isOnline
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          )}>
            {isOnline ? 'Online' : host ? 'Offline' : 'Unknown'}
          </span>
          <button onClick={reload} className="p-1 rounded hover:bg-surface-hover transition-colors" aria-label="Refresh">
            <RefreshCw className="size-3.5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* WAN */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">WAN</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="WAN IP"  value={wanIp} />
          <StatTile label="ISP"     value={isp} />
          <StatTile
            label="WAN Uptime"
            value={wanUp != null ? `${wanUp}%` : '—'}
            accent={wanUp != null && wanUp < 99}
          />
          <StatTile
            label="Latency"
            value={latency != null ? `${latency} ms` : '—'}
            sub={highLat ? 'High latency' : undefined}
            accent={!!highLat}
          />
        </div>
      </div>

      {/* Devices + Clients */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Devices &amp; Clients</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={cn(
            'p-3 rounded-lg border flex items-center gap-3',
            offlineDevices > 0
              ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/50'
              : 'bg-surface border-border',
          )}>
            <Server className={cn('size-5 shrink-0', offlineDevices > 0 ? 'text-red-500' : 'text-text-muted')} />
            <div>
              <p className={cn('text-xs', offlineDevices > 0 ? 'text-red-500' : 'text-text-muted')}>Devices</p>
              <p className={cn('text-sm font-semibold', offlineDevices > 0 ? 'text-red-600 dark:text-red-400' : 'text-text-primary')}>
                {onlineDevices ?? '—'} / {totalDevices ?? '—'}
              </p>
              {offlineDevices > 0 && (
                <p className="text-xs text-red-500">{offlineDevices} offline</p>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-border flex items-center gap-3">
            <UsersIcon className="size-5 text-text-muted shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Clients</p>
              <p className="text-sm font-semibold text-text-primary">{totalClients ?? '—'}</p>
              {wiredClients != null && wifiClients != null && (
                <p className="text-xs text-text-muted">{wiredClients} wired · {wifiClients} wifi</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {(!site && !host) && (
        <div className="text-center py-6 text-sm text-text-muted">
          No data returned for site <code className="font-mono text-xs">{siteId}</code>.
          Verify the Site ID is correct.
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'alerts' | 'logs' | 'backup' | 'network' | 'assets';

export function CustomerDetailPage() {
  const { id }            = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const { profile }       = useAuth();
  const { detail, loading, error, reload } = useCustomerDetail(id);
  const { editCustomer }  = useCustomers();

  const [activeTab,      setActiveTab]      = useState<Tab>('alerts');
  const [editOpen,       setEditOpen]       = useState(false);
  // Optimistic health from UniFi — overrides the DB value until next full reload
  const [healthOverride, setHealthOverride] = useState<HealthStatus | null>(null);

  const canEdit = profile?.role === 'superadmin' || profile?.role === 'admin' || profile?.role === 'technician';

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="skeleton h-8 w-72 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertCircle className="size-8 text-red-500" />
        <p className="text-lg font-semibold text-text-primary">Customer not found</p>
        <p className="text-sm text-text-muted">{error ?? 'This customer may have been deleted or you lack access.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const { customer: c, alerts, logs, backupJobs, assignedUsers } = detail;
  const openAlerts    = alerts.filter(a => !a.resolved);
  const failedJobs    = backupJobs.filter(j => j.status === 'failed');
  const activeInteg   = INTEGRATION_META.filter(m => c.integrations[m.key]);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'alerts',  label: 'Alerts',      count: openAlerts.length || undefined },
    { id: 'backup',  label: 'Backup Jobs', count: failedJobs.length || undefined },
    { id: 'logs',    label: 'Logs' },
    { id: 'assets',  label: 'Assets' },
    ...(c.integrations.unifi ? [{ id: 'network' as Tab, label: 'Network' }] : []),
  ];

  return (
    <div className="space-y-5">

      {/* Breadcrumb + title */}
      <div>
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-2 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Customers
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-text-primary">{c.name}</h1>
              <Badge variant={healthVariant[healthOverride ?? c.health]} dot className="capitalize">
                {healthOverride ?? c.health}
              </Badge>
              <Badge variant={c.status === 'active' ? 'success' : c.status === 'archived' ? 'default' : 'info'} className="capitalize">{c.status}</Badge>
            </div>
            <p className="text-sm text-text-muted mt-0.5">
              {[c.domain, c.address, c.state].filter(Boolean).join(' · ')}
              {c.tier && <span className="ml-2 capitalize text-text-secondary">· {c.tier}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh">
              <RefreshCw className="size-4" />
            </Button>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Open Alerts"
          value={openAlerts.length}
          sub={openAlerts.length > 0 ? `${alerts.filter(a => a.severity === 'critical' && !a.resolved).length} critical` : 'All clear'}
          accent={openAlerts.length > 0}
        />
        <StatCard
          label="Backup Jobs"
          value={backupJobs.length}
          sub={failedJobs.length > 0 ? `${failedJobs.length} failed` : backupJobs.length > 0 ? 'All passing' : 'None configured'}
          accent={failedJobs.length > 0}
        />
        <StatCard
          label="Integrations"
          value={activeInteg.length}
          sub={activeInteg.length > 0 ? activeInteg.map(i => i.label).join(', ') : 'None enabled'}
        />
        <StatCard
          label="Last Sync"
          value={formatDistanceToNow(new Date(c.lastSync), { addSuffix: false })}
          sub="ago"
        />
      </div>

      {/* Main body: tabbed content + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Tabbed content */}
        <div className="lg:col-span-2">
          <Card>
            {/* Tab bar */}
            <div className="flex border-b border-border px-4 gap-1 pt-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px',
                    activeTab === tab.id
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="inline-flex items-center justify-center size-4 rounded-full bg-accent text-white text-[10px] font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <CardBody className="p-0">
              {activeTab === 'alerts'  && <AlertsTab  alerts={alerts} />}
              {activeTab === 'logs'    && <LogsTab     logs={logs} />}
              {activeTab === 'backup'  && <BackupTab   jobs={backupJobs} />}
              {activeTab === 'assets'  && <AssetsTab   customerId={c.id} canEdit={canEdit} />}
              {activeTab === 'network' && (
                <NetworkTab
                  siteId={c.unifiSiteId}
                  customerId={c.id}
                  onHealthChange={setHealthOverride}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">

          {/* Contacts */}
          <Card>
            <CardHeader title="Contacts" />
            <CardBody className="space-y-4">
              <ContactCard title="Primary Contact"   contact={c.primaryContact} />
              <ContactCard title="Secondary Contact" contact={c.billingContact} />
              {!c.primaryContact?.name && !c.primaryContact?.email && (
                <p className="text-sm text-text-muted">No contacts recorded.</p>
              )}
            </CardBody>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader title="Integrations" />
            <CardBody className="space-y-1.5">
              {INTEGRATION_META.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center gap-2.5">
                  <div className={cn(
                    'size-7 rounded-lg flex items-center justify-center shrink-0',
                    c.integrations[key] ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-surface',
                  )}>
                    <Icon className={cn('size-3.5', c.integrations[key] ? 'text-emerald-500' : 'text-text-muted')} />
                  </div>
                  <span className={cn('text-sm', c.integrations[key] ? 'text-text-primary font-medium' : 'text-text-muted line-through')}>
                    {label}
                  </span>
                  {c.integrations[key]
                    ? <CheckCircle2 className="size-3.5 text-emerald-500 ml-auto" />
                    : <span className="text-xs text-text-muted ml-auto">Off</span>
                  }
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Assigned users */}
          {assignedUsers.length > 0 && (
            <Card>
              <CardHeader title="Assigned Users" />
              <CardBody className="space-y-2">
                {assignedUsers.map(u => {
                  const RoleIcon = roleIcon[u.role];
                  return (
                    <div key={u.id} className="flex items-center gap-2.5">
                      <Avatar name={u.name ?? u.email} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{u.name ?? u.email}</p>
                        <p className="text-xs text-text-muted truncate">{u.email}</p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium shrink-0', roleColor[u.role])}>
                        <RoleIcon className="size-3" />
                        <span className="capitalize">{u.role}</span>
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {/* Notes */}
          {c.notes && (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editOpen && (
        <CustomerForm
          open
          initial={c}
          onClose={() => setEditOpen(false)}
          onSave={async (data) => {
            await editCustomer(c.id, data);
            setEditOpen(false);
            await reload();
            // If UniFi was just enabled, switch to the Network tab automatically
            if (data.unifi && data.unifiSiteId) setActiveTab('network');
          }}
        />
      )}
    </div>
  );
}
