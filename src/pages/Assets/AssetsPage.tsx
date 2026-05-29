import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, AlertCircle,
  Laptop, Server, Network, Smartphone, Printer, Package, Shield, Wifi, HardDrive, Monitor, Home, Wrench, Cctv, Cpu, Lock, ShieldCheck,
  ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2, X,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { cn } from '../../components/ui/cn';
import { ResizableColGroup, ResizableTh, useResizableColumns } from '../../components/ui/ResizableColumns';
import { useAllAssets } from '../../hooks/useAssets';
import { useCustomers } from '../../hooks/useCustomers';
import { deleteAsset, insertAsset, updateAsset } from '../../lib/db';
import { formatDateNo } from '../../lib/dateFormat';
import { AssetForm } from './AssetForm';
import type { Asset, AssetType } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<AssetType, { label: string; icon: React.ElementType }> = {
  computer: { label: 'Computer', icon: Laptop },
  server: { label: 'Server', icon: Server },
  router_firewall: { label: 'Router / Firewall', icon: Shield },
  access_point: { label: 'Access point', icon: Wifi },
  switch: { label: 'Switch', icon: HardDrive },
  network_equipment: { label: 'Network Equipment', icon: Network },
  mobile_device: { label: 'Mobile device', icon: Smartphone },
  printer: { label: 'Printer', icon: Printer },
  license_subscription: { label: 'License / Subscription', icon: Package },
  audio_video: { label: 'Audio / Video', icon: Monitor },
  camera: { label: 'Camera', icon: Cctv },
  iot: { label: 'IoT', icon: Cpu },
  access_control: { label: 'Access control', icon: Lock },
  security: { label: 'Security', icon: ShieldCheck },
  home_appliances: { label: 'Home appliances', icon: Home },
  tools: { label: 'Tools', icon: Wrench },
  other: { label: 'Other', icon: Package },
};

const WARRANTY_WARN_DAYS = 90;

function warrantyStatus(warrantyEnd?: string): 'expired' | 'soon' | 'ok' | null {
  if (!warrantyEnd) return null;
  const days = Math.floor((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
  if (days < 0)                  return 'expired';
  if (days < WARRANTY_WARN_DAYS) return 'soon';
  return 'ok';
}

function assetStatusOrder(status: Asset['status']): number {
  if (status === 'active') return 0;
  if (status === 'spare') return 1; // shown as Spare in filters
  return 2; // retired
}

// ── Sort ─────────────────────────────────────────────────────────────────────

type SortKey =
  | 'name'
  | 'type'
  | 'customer'
  | 'make'
  | 'model'
  | 'serial'
  | 'site'
  | 'location'
  | 'ipAddress'
  | 'macAddress'
  | 'status'
  | 'purchaseDate'
  | 'warrantyEnd';
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
      case 'make':       av = a.make        ?? '';              bv = b.make        ?? '';              break;
      case 'model':      av = a.model       ?? '';              bv = b.model       ?? '';              break;
      case 'serial':     av = a.serial      ?? '';              bv = b.serial      ?? '';              break;
      case 'site':       av = a.site        ?? '';              bv = b.site        ?? '';              break;
      case 'location':   av = a.location    ?? '';              bv = b.location    ?? '';              break;
      case 'ipAddress':  av = a.ipAddress   ?? '';              bv = b.ipAddress   ?? '';              break;
      case 'macAddress': av = a.macAddress  ?? '';              bv = b.macAddress  ?? '';              break;
      case 'status':     av = a.status;                         bv = b.status;                         break;
      case 'purchaseDate':av = a.purchaseDate ?? '';            bv = b.purchaseDate ?? '';            break;
      case 'warrantyEnd':av = a.warrantyEnd ?? '';              bv = b.warrantyEnd ?? '';              break;
    }
    const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── PDF export ────────────────────────────────────────────────────────────────

function exportToPdf(
  assets: Asset[],
  customerMap: Record<string, string>,
  scopeLabel?: string,
) {
  const now = new Date().toLocaleString();
  const rows = assets.map(a => {
    const ws = warrantyStatus(a.warrantyEnd);
    const warLabel = a.warrantyEnd
      ? `${formatDateNo(a.warrantyEnd)}${ws === 'expired' ? ' ⚠ expired' : ws === 'soon' ? ' ⚠ soon' : ''}`
      : '—';
    return `
      <tr>
        <td>${a.name}${a.make || a.model ? `<br><small>${[a.make, a.model].filter(Boolean).join(' ')}</small>` : ''}</td>
        <td>${TYPE_META[a.type]?.label ?? a.type}</td>
        <td>${customerMap[a.customerId] ?? '—'}</td>
        <td>${a.make ?? '—'}</td>
        <td>${a.model ?? '—'}</td>
        <td class="mono">${a.serial ?? '—'}</td>
        <td>${a.site ?? '—'}</td>
        <td>${a.location ?? '—'}</td>
        <td class="mono">${a.ipAddress ?? '—'}</td>
        <td class="mono">${a.macAddress ?? '—'}</td>
        <td>${a.status}</td>
        <td class="mono">${formatDateNo(a.purchaseDate)}</td>
        <td class="${ws === 'expired' ? 'warn-expired' : ws === 'soon' ? 'warn-soon' : ''}">${warLabel}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Asset Register${scopeLabel ? ` — ${scopeLabel}` : ''} — ${now}</title>
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
  <p class="meta">Exported ${now}${scopeLabel ? ` · ${scopeLabel}` : ''} · ${assets.length} asset${assets.length !== 1 ? 's' : ''}</p>
  <table>
    <thead>
      <tr>
        <th>Asset</th><th>Type</th><th>Customer</th><th>Make</th><th>Model</th><th>Serial</th>
        <th>Site</th><th>Location</th><th>IP Address</th><th>MAC Address</th><th>Status</th><th>Purchase</th><th>Warranty</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    window.alert('PDF export blocked by the browser.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 500);
    }
  }, 150);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  // Escape for CSV and wrap in quotes when needed.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportToCsv(assets: Asset[], customerMap: Record<string, string>, scopeLabel?: string) {
  const header = [
    'Asset',
    'Type',
    'Customer',
    'Make',
    'Model',
    'Serial',
    'Site',
    'Location',
    'IP Address',
    'MAC Address',
    'Status',
    'Purchase Date',
    'Warranty',
  ];

  const rows = assets.map(a => {
    const ws = warrantyStatus(a.warrantyEnd);
    const warLabel = a.warrantyEnd
      ? `${formatDateNo(a.warrantyEnd)}${ws === 'expired' ? ' ⚠ expired' : ws === 'soon' ? ' ⚠ soon' : ''}`
      : '—';

    const assetLabel = [a.name, a.make || a.model ? `${a.make || ''}${a.model ? ` ${a.model}` : ''}`.trim() : '']
      .filter(Boolean)
      .join(' — ');

    return [
      assetLabel,
      TYPE_META[a.type]?.label ?? a.type,
      customerMap[a.customerId] ?? '—',
      a.make ?? '—',
      a.model ?? '—',
      a.serial ?? '—',
      a.site ?? '—',
      a.location ?? '—',
      a.ipAddress ?? '—',
      a.macAddress ?? '—',
      a.status,
      formatDateNo(a.purchaseDate),
      warLabel,
    ].map(csvEscape);
  });

  const csv = [
    // BOM helps Excel detect UTF-8 properly
    '\uFEFF' + header.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');

  const scope = scopeLabel ? `_${scopeLabel}` : '';
  const safeScope = scope.replace(/[^a-z0-9_-]/gi, '_');
  downloadTextFile(`assets_export${safeScope}_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');

  // Optional: lightweight feedback
  // eslint-disable-next-line no-alert
  // window.alert('CSV export started');
}

function ResizableSortTh({
  colKey,
  label,
  sortKey,
  active,
  dir,
  onSort,
  widths,
  onResize,
}: {
  colKey: SortKey;
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  widths: Record<string, number>;
  onResize: (key: string, nextWidth: number) => void;
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <ResizableTh colKey={colKey} widths={widths} onResize={onResize}>
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
    </ResizableTh>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({ asset, customerName, onViewCustomer, onEdit, onDelete, onOpenDetails }: {
  asset: Asset;
  customerName: string;
  onViewCustomer: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onOpenDetails: (asset: Asset) => void;
}) {
  const { icon: Icon, label: typeLabel } = TYPE_META[asset.type] ?? TYPE_META.other;
  const ws = warrantyStatus(asset.warrantyEnd);

  return (
    <tr
      className="border-b border-border hover:bg-surface-raised/40 transition-colors cursor-pointer"
      onClick={() => onOpenDetails(asset)}
    >
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
          onClick={(e) => {
            e.stopPropagation();
            onViewCustomer(asset.customerId);
          }}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          {customerName}
          <ExternalLink className="size-3" />
        </button>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted">{asset.make ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted">{asset.model ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{asset.serial ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted">{asset.site ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted">{asset.location ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{asset.ipAddress ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{asset.macAddress ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
          asset.status === 'active'  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
          asset.status === 'spare'   ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                       'bg-surface text-text-muted border border-border',
        )}>{asset.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">{formatDateNo(asset.purchaseDate)}</td>
      <td className="px-4 py-3">
        {ws === null ? <span className="text-xs text-text-muted">—</span> : (
          <span className={cn(
            'text-xs',
            ws === 'expired' ? 'text-red-500 font-medium' :
            ws === 'soon'    ? 'text-amber-500 font-medium' :
                               'text-text-muted',
          )}>
            {formatDateNo(asset.warrantyEnd)}
            {ws === 'expired' && ' (expired)'}
            {ws === 'soon'    && ' (soon)'}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(asset);
            }}
            aria-label="Edit asset"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
            aria-label="Delete asset"
          >
            <Trash2 className="size-3.5 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  'All',
  'access_point',
  'access_control',
  'audio_video',
  'camera',
  'computer',
  'home_appliances',
  'iot',
  'license_subscription',
  'mobile_device',
  'network_equipment',
  'other',
  'printer',
  'router_firewall',
  'server',
  'security',
  'switch',
  'tools',
] as const;

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Asset',       key: 'name'       },
  { label: 'Type',        key: 'type'       },
  { label: 'Customer',    key: 'customer'   },
  { label: 'Make',        key: 'make'       },
  { label: 'Model',       key: 'model'      },
  { label: 'Serial',      key: 'serial'     },
  { label: 'Site',        key: 'site'       },
  { label: 'Location',    key: 'location'   },
  { label: 'IP Address',  key: 'ipAddress'  },
  { label: 'MAC Address', key: 'macAddress' },
  { label: 'Status',      key: 'status'     },
  { label: 'Purchase',    key: 'purchaseDate'},
  { label: 'Warranty',    key: 'warrantyEnd'},
];

export function AssetsPage() {
  const navigate = useNavigate();
  const { assets, loading, error, reload } = useAllAssets();
  const { customers } = useCustomers();

  const [query,        setQuery]        = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('All');
  const [typeFilter,   setTypeFilter]   = useState<string>('All');
  const [statusVisible, setStatusVisible] = useState<Record<Asset['status'], boolean>>({
    active: true,
    spare: true,
    retired: true,
  });
  const [sortKey,      setSortKey]      = useState<SortKey>('customer');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [addCustomerId, setAddCustomerId] = useState<string>('');

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map(c => [c.id, c.name])),
    [customers],
  );
  const customerById = useMemo(
    () => Object.fromEntries(customers.map(c => [c.id, c])),
    [customers],
  );

  const assetsCols = useMemo(
    () => ([
      { key: 'name' },
      { key: 'type' },
      { key: 'customer' },
      { key: 'make' },
      { key: 'model' },
      { key: 'serial' },
      { key: 'site' },
      { key: 'location' },
      { key: 'ipAddress' },
      { key: 'macAddress' },
      { key: 'status' },
      { key: 'purchaseDate' },
      { key: 'warrantyEnd' },
      { key: 'actions' },
    ] as const),
    [],
  );

  const { widths: colWidths, setWidth: setColWidth } = useResizableColumns({
    tableId: 'assets',
    defaults: {
      name: 260,
      type: 140,
      customer: 220,
      make: 140,
      model: 160,
      serial: 160,
      site: 140,
      location: 160,
      ipAddress: 140,
      macAddress: 160,
      status: 120,
      purchaseDate: 140,
      warrantyEnd: 140,
      actions: 120,
    },
    minWidth: 90,
    maxWidth: 520,
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function handleDelete(asset: Asset) {
    if (!window.confirm(`Delete asset "${asset.name}"?`)) return;
    setDeletingId(asset.id);
    try {
      await deleteAsset(asset.id);
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete asset');
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(asset: Asset) {
    setEditingAsset(asset);
    setAssetFormOpen(true);
    setSelectedAsset(null);
  }

  function handleAddAsset() {
    const firstCustomerId = customers[0]?.id ?? '';
    setAddCustomerId(firstCustomerId);
    setAddPickerOpen(true);
  }

  function handleOpenDetails(asset: Asset) {
    setSelectedAsset(asset);
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const base = assets.filter(a => {
      if (typeFilter   !== 'All' && a.type   !== typeFilter)   return false;
      if (!statusVisible[a.status]) return false;
      if (customerFilter !== 'All' && a.customerId !== customerFilter) return false;
      if (!q) return true;
      const cName = customerMap[a.customerId]?.toLowerCase() ?? '';
      return (
        a.name.toLowerCase().includes(q)         ||
        (a.make?.toLowerCase().includes(q))      ||
        (a.model?.toLowerCase().includes(q))     ||
        (a.serial?.toLowerCase().includes(q))    ||
        (a.site?.toLowerCase().includes(q))      ||
        (a.location?.toLowerCase().includes(q))  ||
        (a.ipAddress?.toLowerCase().includes(q)) ||
        (a.macAddress?.toLowerCase().includes(q)) ||
        cName.includes(q)
      );
    });
    const sorted = sortAssets(base, customerMap, sortKey, sortDir);
    return [...sorted].sort((a, b) => assetStatusOrder(a.status) - assetStatusOrder(b.status));
  }, [assets, typeFilter, statusVisible, customerFilter, query, customerMap, sortKey, sortDir]);

  const expiringCount = assets.filter(a => {
    if (a.status !== 'active') return false;
    const ws = warrantyStatus(a.warrantyEnd);
    return ws === 'expired' || ws === 'soon';
  }).length;

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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
          <Button variant="primary" size="sm" onClick={handleAddAsset} disabled={customers.length === 0}>
            Add asset
          </Button>
          <div ref={exportRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(v => !v)}
              disabled={filtered.length === 0}
              rightIcon={<ChevronDown className="size-3.5" />}
            >
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-surface-raised border border-border rounded-lg shadow-popover z-20 py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                  onClick={() => {
                    const scopeLabel = customerFilter === 'All'
                      ? undefined
                      : (customerMap[customerFilter] ?? 'Customer');
                    exportToPdf(filtered, customerMap, scopeLabel);
                    setExportOpen(false);
                  }}
                >
                  Export to PDF
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                  onClick={() => {
                    const scopeLabel = customerFilter === 'All'
                      ? undefined
                      : (customerMap[customerFilter] ?? 'Customer');
                    exportToCsv(filtered, customerMap, scopeLabel);
                    setExportOpen(false);
                  }}
                >
                  Export to CSV
                </button>
              </div>
            )}
          </div>
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
            clearable
            onClear={() => setQuery('')}
          />
        </div>
        <select
          value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value)}
          className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="All">All customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 w-44 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="All">All types</option>
          {ALL_TYPES.slice(1).map(t => (
            <option key={t} value={t}>{TYPE_META[t as AssetType].label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setStatusVisible(prev => ({ ...prev, active: !prev.active }))}
            className={cn(
              'h-7 px-2.5 rounded text-xs font-medium transition-colors',
              statusVisible.active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'text-text-muted hover:text-text-primary',
            )}
            title={statusVisible.active ? 'Hide active' : 'Show active'}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatusVisible(prev => ({ ...prev, spare: !prev.spare }))}
            className={cn(
              'h-7 px-2.5 rounded text-xs font-medium transition-colors',
              statusVisible.spare ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'text-text-muted hover:text-text-primary',
            )}
            title={statusVisible.spare ? 'Hide spare' : 'Show spare'}
          >
            Spare
          </button>
          <button
            type="button"
            onClick={() => setStatusVisible(prev => ({ ...prev, retired: !prev.retired }))}
            className={cn(
              'h-7 px-2.5 rounded text-xs font-medium transition-colors',
              statusVisible.retired ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'text-text-muted hover:text-text-primary',
            )}
            title={statusVisible.retired ? 'Hide retired' : 'Show retired'}
          >
            Retired
          </button>
        </div>
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
                ? "No assets yet. Add them from this page or from a customer's Assets tab."
                : 'No assets match your filters.'}
            </p>
          ) : (
            <table className="w-full text-left">
              <ResizableColGroup columns={assetsCols as unknown as Array<{ key: string }>} widths={colWidths} />
              <thead>
                <tr className="border-b border-border bg-surface-raised/50">
                  {([
                    ['name','Asset'],
                    ['type','Type'],
                    ['customer','Customer'],
                    ['make','Make'],
                    ['model','Model'],
                    ['serial','Serial'],
                    ['site','Site'],
                    ['location','Location'],
                    ['ipAddress','IP Address'],
                    ['macAddress','MAC Address'],
                    ['status','Status'],
                    ['purchaseDate','Purchase'],
                    ['warrantyEnd','Warranty'],
                  ] as Array<[SortKey, string]>).map(([k, label]) => (
                    <ResizableSortTh
                      key={k}
                      colKey={k}
                      label={label}
                      sortKey={k}
                      active={sortKey === k}
                      dir={sortDir}
                      onSort={handleSort}
                      widths={colWidths}
                      onResize={setColWidth}
                    />
                  ))}
                  <ResizableTh colKey="actions" widths={colWidths} onResize={setColWidth} className="text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Actions
                    </span>
                  </ResizableTh>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <AssetRow
                    key={a.id}
                    asset={a}
                    customerName={customerMap[a.customerId] ?? 'Unknown'}
                    onViewCustomer={id => navigate(`/customers/${id}`)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onOpenDetails={handleOpenDetails}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
      {deletingId && (
        <p className="text-xs text-text-muted">Deleting asset…</p>
      )}

      {/* Add asset → pick customer */}
      {addPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="absolute inset-0" onClick={() => setAddPickerOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-surface-raised border border-border rounded-card shadow-modal">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Add asset</h2>
                <p className="text-xs text-text-muted mt-0.5">Select which customer the asset belongs to.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAddPickerOpen(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-secondary">Customer</p>
                <select
                  value={addCustomerId}
                  onChange={e => setAddCustomerId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setAddPickerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setAddPickerOpen(false);
                    setEditingAsset(null);
                    setSelectedAsset(null);
                    setAssetFormOpen(true);
                  }}
                  disabled={!addCustomerId}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset detail drawer */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="absolute inset-0" onClick={() => setSelectedAsset(null)} />
          <aside className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-surface-raised border border-border rounded-card flex flex-col shadow-modal">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary truncate pr-4">{selectedAsset.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAsset(null)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ['Contact', customerById[selectedAsset.customerId]?.primaryContact?.name ?? '—'],
                  ['eMail', customerById[selectedAsset.customerId]?.primaryContact?.email ?? '—'],
                  ['Phone', customerById[selectedAsset.customerId]?.primaryContact?.phone ?? '—'],
                  ['Type', selectedAsset.type],
                  ['Status', selectedAsset.status],
                  ['Make', selectedAsset.make ?? '—'],
                  ['Model', selectedAsset.model ?? '—'],
                  ['Serial', selectedAsset.serial ?? '—'],
                  ['Site', selectedAsset.site ?? '—'],
                  ['Operating system', selectedAsset.os ?? '—'],
                  ['IP address', selectedAsset.ipAddress ?? '—'],
                  ['MAC address', selectedAsset.macAddress ?? '—'],
                  ['Location', selectedAsset.location ?? '—'],
                  ['Purchase date', formatDateNo(selectedAsset.purchaseDate)],
                  ['Warranty', formatDateNo(selectedAsset.warrantyEnd)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-text-muted uppercase tracking-wider">{label}</dt>
                    <dd className="text-text-primary mt-0.5 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {selectedAsset.notes && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-text-primary mt-1 whitespace-pre-wrap">{selectedAsset.notes}</p>
                </div>
              )}
              <div className="pt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAsset(selectedAsset);
                    setAssetFormOpen(true);
                    setSelectedAsset(null);
                  }}
                >
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/customers/${selectedAsset.customerId}?tab=assets`)}
                >
                  Open customer
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <AssetForm
        open={assetFormOpen}
        onClose={() => {
          setAssetFormOpen(false);
          setEditingAsset(null);
        }}
        initial={editingAsset}
        onSave={async (p) => {
          if (editingAsset) {
            await updateAsset(editingAsset.id, p);
          } else {
            if (!addCustomerId) throw new Error('Please select a customer first.');
            await insertAsset(addCustomerId, p);
          }
          await reload();
          setAssetFormOpen(false);
          setEditingAsset(null);
        }}
      />
    </div>
  );
}
