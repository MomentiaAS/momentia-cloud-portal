import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, AlertCircle,
  Laptop, Server, Network, Smartphone, Printer, Package,
  ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, FileDown,
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
  computer: { label: 'Computer',          icon: Laptop     },
  server:   { label: 'Server',            icon: Server     },
  network:  { label: 'Network Equipment', icon: Network    },
  mobile:   { label: 'Mobile',            icon: Smartphone },
  printer:  { label: 'Printer',           icon: Printer    },
  license:  { label: 'License',           icon: Package    },
  other:    { label: 'Other',             icon: Package    },
};

const WARRANTY_WARN_DAYS = 90;

function warrantyStatus(warrantyEnd?: string): 'expired' | 'soon' | 'ok' | null {
  if (!warrantyEnd) return null;
  const days = Math.floor((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
  if (days < 0)                  return 'expired';
  if (days < WARRANTY_WARN_DAYS) return 'soon';
  return 'ok';
}

// ── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'type' | 'customer' | 'serial' | 'assignedTo' | 'status' | 'warrantyEnd';
type SortDir = 'asc' | 'desc';

function sortAssets(
  assets: Asset[],
  customerMap: Record<string, string>,
  key: SortKey,
  dir: SortDir,
): Asset[] {
  return [...assets].sort((a, b) => {
    let av = '';
    let bv = '';
    switch (key) {
      case 'name':       av = a.name;                           bv = b.name;                           break;
      case 'type':       av = TYPE_META[a.type]?.label ?? '';   bv = TYPE_META[b.type]?.label ?? '';   break;
      case 'customer':   av = customerMap[a.customerId] ?? '';  bv = customerMap[b.customerId] ?? '';  break;
      case 'serial':     av = a.serial      ?? '';              bv = b.serial      ?? '';              break;
      case 'assignedTo': av = a.assignedTo  ?? '';              bv = b.assignedTo  ?? '';              break;
      case 'status':     av = a.status;                         bv = b.status;                         break;
      case 'warrantyEnd':av = a.warrantyEnd ?? '';              bv = b.warrantyEnd ?? '';              break;
    }
    const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── PDF export ────────────────────────────────────────────────────────────────

function exportToPdf(assets: Asset[], customerMap: Record<string, string>) {
  const now = new Date().toLocaleString();
  const rows = assets.map(a => {
    const ws = warrantyStatus(a.warrantyEnd);
    const warLabel = a.warrantyEnd
      ? `${a.warrantyEnd}${ws === 'expired' ? ' ⚠ expired' : ws === 'soon' ? ' ⚠ soon' : ''}`
      : '—';
    return `
      <tr>
        <td>${a.name}${a.make || a.model ? `<br><small>${[a.make, a.model].filter(Boolean).join(' ')}</small>` : ''}</td>
        <td>${TYPE_META[a.type]?.label ?? a.type}</td>
        <td>${customerMap[a.customerId] ?? '—'}</td>
        <td class="mono">${a.serial ?? '—'}</td>
        <td>${a.assignedTo ?? '—'}</td>
        <td class="mono">${a.ipAddress ?? '—'}</td>
        <td>${a.status}</td>
        <td class="${ws === 'expired' ? 'warn-expired' : ws === 'soon' ? 'warn-soon' : ''}">${warLabel}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Asset Register — ${now}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px;
         text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    small { color: #6b7280; }
    .mono { font-family: monospace; }
    .warn-expired { color: #dc2626; font-weight: 600; }
    .warn-soon    { color: #d97706; font-weight: 600; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>Asset Register</h1>
  <p class="meta">Exported ${now} · ${assets.length} asset${assets.length !== 1 ? 's' : ''}</p>
  <table>
    <thead>
      <tr>
        <th>Asset</th><th>Type</th><th>Customer</th><th>Serial</th>
        <th>Assigned To</th><th>IP Address</th><th>Status</th><th>Warranty</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
}

// ── Sortable header cell ──────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onSort,
}: {
  label: string; sortKey: SortKey;
  active: boolean; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className="px-4 py-2.5">
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
          active ? 'text-accent' : 'text-text-muted hover:text-text-primary',
        )}
      >
        {label}
        <Icon className="size-3 shrink-0" />
      </button>
    </th>
  );
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
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{asset.ipAddress ?? '—'}</td>
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

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Asset',       key: 'name'       },
  { label: 'Type',        key: 'type'       },
  { label: 'Customer',    key: 'customer'   },
  { label: 'Serial',      key: 'serial'     },
  { label: 'Assigned To', key: 'assignedTo' },
  { label: 'IP Address',  key: 'serial'     }, // display only, not sortable — handled separately
  { label: 'Status',      key: 'status'     },
  { label: 'Warranty',    key: 'warrantyEnd'},
];

export function AssetsPage() {
  const navigate = useNavigate();
  const { assets, loading, error, reload } = useAllAssets();
  const { customers } = useCustomers();

  const [query,        setQuery]        = useState('');
  const [typeFilter,   setTypeFilter]   = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortKey,      setSortKey]      = useState<SortKey>('customer');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map(c => [c.id, c.name])),
    [customers],
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = assets.filter(a => {
      if (typeFilter   !== 'All' && a.type   !== typeFilter)   return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (!q) return true;
      const cName = customerMap[a.customerId]?.toLowerCase() ?? '';
      return (
        a.name.toLowerCase().includes(q)         ||
        (a.make?.toLowerCase().includes(q))      ||
        (a.model?.toLowerCase().includes(q))     ||
        (a.serial?.toLowerCase().includes(q))    ||
        (a.assignedTo?.toLowerCase().includes(q))||
        (a.ipAddress?.toLowerCase().includes(q)) ||
        cName.includes(q)
      );
    });
    return sortAssets(base, customerMap, sortKey, sortDir);
  }, [assets, typeFilter, statusFilter, query, customerMap, sortKey, sortDir]);

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
              <span className="ml-2 text-amber-500 font-medium">
                · {expiringCount} warranty issue{expiringCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToPdf(filtered, customerMap)}
            disabled={filtered.length === 0}
          >
            <FileDown className="size-4" />
            Export PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
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
          subtitle={`${filtered.length} of ${assets.length} assets · sorted by ${COLUMNS.find(c => c.key === sortKey)?.label ?? sortKey} (${sortDir})`}
        />
        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-sm text-center text-text-muted">
              {assets.length === 0
                ? "No assets yet. Add them from a customer's Assets tab."
                : 'No assets match your filters.'}
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-surface-raised/50">
                  {(['name','type','customer','serial','assignedTo'] as SortKey[]).map((k, i) => (
                    <SortTh
                      key={k}
                      label={['Asset','Type','Customer','Serial','Assigned To'][i]}
                      sortKey={k}
                      active={sortKey === k}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                  {/* IP Address — display only */}
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    IP Address
                  </th>
                  {(['status','warrantyEnd'] as SortKey[]).map((k, i) => (
                    <SortTh
                      key={k}
                      label={['Status','Warranty'][i]}
                      sortKey={k}
                      active={sortKey === k}
                      dir={sortDir}
                      onSort={handleSort}
                    />
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
