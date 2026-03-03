import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, AlertCircle,
  Laptop, Server, Network, Smartphone, Printer, Package,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { cn } from '../../components/ui/cn';
import { useAllAssets } from '../../hooks/useAssets';
import { useCustomers } from '../../hooks/useCustomers';
import type { Asset, AssetType } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<AssetType, { label: string; icon: React.ElementType }> = {
  computer: { label: 'Computer',          icon: Laptop    },
  server:   { label: 'Server',            icon: Server    },
  network:  { label: 'Network Equipment', icon: Network   },
  mobile:   { label: 'Mobile',            icon: Smartphone },
  printer:  { label: 'Printer',           icon: Printer   },
  license:  { label: 'License',           icon: Package   },
  other:    { label: 'Other',             icon: Package   },
};

const WARRANTY_WARN_DAYS = 90;

function warrantyStatus(warrantyEnd?: string): 'expired' | 'soon' | 'ok' | null {
  if (!warrantyEnd) return null;
  const days = Math.floor((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
  if (days < 0)                  return 'expired';
  if (days < WARRANTY_WARN_DAYS) return 'soon';
  return 'ok';
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({ asset, customerName, onViewCustomer }: {
  asset: Asset;
  customerName: string;
  onViewCustomer: (id: string) => void;
}) {
  const { icon: Icon, label: typeLabel } = TYPE_META[asset.type] ?? TYPE_META.other;
  const ws = warrantyStatus(asset.warrantyEnd);

  return (
    <tr className="border-b border-border hover:bg-surface-raised/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
            <Icon className="size-3.5 text-text-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{asset.name}</p>
            {(asset.make || asset.model) && (
              <p className="text-xs text-text-muted">{[asset.make, asset.model].filter(Boolean).join(' ')}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary">{typeLabel}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onViewCustomer(asset.customerId)}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          {customerName}
          <ExternalLink className="size-3" />
        </button>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{asset.serial ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted">{asset.assignedTo ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
          asset.status === 'active'  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
          asset.status === 'spare'   ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                       'bg-surface text-text-muted border border-border',
        )}>{asset.status}</span>
      </td>
      <td className="px-4 py-3">
        {ws === null ? <span className="text-xs text-text-muted">—</span> : (
          <span className={cn(
            'text-xs',
            ws === 'expired' ? 'text-red-500 font-medium' :
            ws === 'soon'    ? 'text-amber-500 font-medium' :
                               'text-text-muted',
          )}>
            {asset.warrantyEnd}
            {ws === 'expired' && ' (expired)'}
            {ws === 'soon'    && ' (soon)'}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ALL_TYPES = ['All', 'computer', 'server', 'network', 'mobile', 'printer', 'license', 'other'] as const;

export function AssetsPage() {
  const navigate = useNavigate();
  const { assets, loading, error, reload } = useAllAssets();
  const { customers } = useCustomers();

  const [query,      setQuery]      = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map(c => [c.id, c.name])),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return assets.filter(a => {
      if (typeFilter !== 'All' && a.type !== typeFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (!q) return true;
      const cName = customerMap[a.customerId]?.toLowerCase() ?? '';
      return (
        a.name.toLowerCase().includes(q)    ||
        (a.make?.toLowerCase().includes(q)) ||
        (a.model?.toLowerCase().includes(q))||
        (a.serial?.toLowerCase().includes(q))||
        (a.assignedTo?.toLowerCase().includes(q))||
        cName.includes(q)
      );
    });
  }, [assets, typeFilter, statusFilter, query, customerMap]);

  const expiringCount = assets.filter(a => {
    const ws = warrantyStatus(a.warrantyEnd);
    return ws === 'expired' || ws === 'soon';
  }).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Assets</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {assets.length} total
            {expiringCount > 0 && (
              <span className="ml-2 text-amber-500 font-medium">· {expiringCount} warranty issue{expiringCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Refresh">
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />{error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Input
            leftIcon={<Search className="size-3.5" />}
            placeholder="Search assets…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="All">All types</option>
          {ALL_TYPES.slice(1).map(t => (
            <option key={t} value={t}>{TYPE_META[t as AssetType].label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="All">All statuses</option>
          <option value="active">Active</option>
          <option value="spare">Spare</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title="All Assets"
          subtitle={`${filtered.length} of ${assets.length} assets`}
        />
        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-sm text-center text-text-muted">
              {assets.length === 0 ? 'No assets yet. Add them from a customer\'s Assets tab.' : 'No assets match your filters.'}
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface-raised/50">
                  {['Asset', 'Type', 'Customer', 'Serial', 'Assigned To', 'Status', 'Warranty'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <AssetRow
                    key={a.id}
                    asset={a}
                    customerName={customerMap[a.customerId] ?? 'Unknown'}
                    onViewCustomer={id => navigate(`/customers/${id}`)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
