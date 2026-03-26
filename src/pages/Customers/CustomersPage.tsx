import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { CustomerSection } from './CustomerSection';
import { CustomerForm } from './CustomerForm';
import { useCustomers } from '../../hooks/useCustomers';
import { useAuth } from '../../context/AuthContext';
import type { Customer } from '../../types';
import type { CustomerSortKey, CustomerSortDir } from './CustomerSection';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
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

function exportCustomersToCsv(customers: Customer[]) {
  const header = ['Customer', 'Status', 'Health', 'Org.nr', 'Address', 'Postcode', 'City', 'Assigned Tech', 'Open Alerts'];
  const rows = customers.map(c => ([
    c.name,
    c.status,
    c.health,
    c.orgNumber ?? '',
    c.address ?? '',
    c.postcode ?? '',
    c.state ?? '',
    c.assignedTech ?? '',
    String(c.openAlerts ?? 0),
  ].map(csvEscape)));

  const csv = ['\uFEFF' + header.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadTextFile(`customers_export_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
}

function exportCustomersToPdf(customers: Customer[]) {
  const now = new Date().toLocaleString();
  const rows = customers.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.status}</td>
      <td>${c.health}</td>
      <td>${c.openAlerts ?? 0}</td>
      <td>${c.assignedTech ?? '—'}</td>
      <td>${c.orgNumber ? `Org.nr ${c.orgNumber}` : '—'}</td>
      <td>${[c.address, c.postcode, c.state].filter(Boolean).join(', ') || '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Customers — ${now}</title>
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
    @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
  </style>
</head>
<body>
  <h1>Customers</h1>
  <p class="meta">Exported ${now} · ${customers.length} customer${customers.length !== 1 ? 's' : ''}</p>
  <table>
    <thead>
      <tr>
        <th>Customer</th><th>Status</th><th>Health</th><th>Alerts</th><th>Assigned</th><th>Org.nr</th><th>Address</th>
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

function sortCustomers(customers: Customer[], sortKey: CustomerSortKey, sortDir: CustomerSortDir): Customer[] {
  const healthOrder: Record<Customer['health'], number> = { critical: 3, degraded: 2, healthy: 1, unknown: 0 };
  return [...customers].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); break;
      case 'health': cmp = (healthOrder[a.health] ?? 0) - (healthOrder[b.health] ?? 0); break;
      case 'alerts': cmp = (a.openAlerts ?? 0) - (b.openAlerts ?? 0); break;
      case 'tier': cmp = String(a.tier).localeCompare(String(b.tier), undefined, { sensitivity: 'base' }); break;
      case 'lastSync': cmp = new Date(a.lastSync).getTime() - new Date(b.lastSync).getTime(); break;
      case 'assignedTech': cmp = String(a.assignedTech ?? '').localeCompare(String(b.assignedTech ?? ''), undefined, { sensitivity: 'base' }); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

export function CustomersPage() {
  const [searchParams]                 = useSearchParams();
  const navigate                       = useNavigate();
  const [query, setQuery]              = useState(searchParams.get('q') ?? '');
  const [groupFilter, setGroupFilter]  = useState<'all' | 'active' | 'potential' | 'archived'>('all');
  const [formOpen, setFormOpen]        = useState(false);
  const [editing, setEditing]          = useState<Customer | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [sortKey, setSortKey] = useState<CustomerSortKey>('name');
  const [sortDir, setSortDir] = useState<CustomerSortDir>('asc');

  const { profile } = useAuth();
  const isRestricted = profile?.role === 'viewer' || profile?.role === 'technician';
  const isCustomerRole = profile?.role === 'viewer';
  const entityLabelPlural = isCustomerRole ? 'Sites' : 'Customers';

  const { customers, loading, error, reload, addCustomer, editCustomer } = useCustomers();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.domain?.toLowerCase().includes(q)) ||
      (c.orgNumber?.toLowerCase().includes(q)) ||
      c.primaryContact.name.toLowerCase().includes(q) ||
      c.assignedTech.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const active    = useMemo(() => sortCustomers(filtered.filter(c => c.status === 'active'), sortKey, sortDir), [filtered, sortKey, sortDir]);
  const potential = useMemo(() => sortCustomers(filtered.filter(c => c.status === 'potential'), sortKey, sortDir), [filtered, sortKey, sortDir]);
  const archived  = useMemo(() => sortCustomers(filtered.filter(c => c.status === 'archived'), sortKey, sortDir), [filtered, sortKey, sortDir]);

  const exportList = useMemo(() => {
    const pool = groupFilter === 'active' ? active
      : groupFilter === 'potential' ? potential
        : groupFilter === 'archived' ? archived
          : [...active, ...potential, ...archived];
    return pool;
  }, [groupFilter, active, potential, archived]);

  function onSort(next: CustomerSortKey) {
    if (sortKey === next) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(next); setSortDir('asc'); }
  }

  function openEdit(c: Customer) { setEditing(c); setFormOpen(true); }
  function openAdd()              { setEditing(null); setFormOpen(true); }
  function handleView(c: Customer) {
    navigate(`/customers/${c.id}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{entityLabelPlural}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {isRestricted
              ? `${customers.length} ${isCustomerRole ? 'site' : 'customer'}${customers.length !== 1 ? 's' : ''}`
              : `${customers.filter(c => c.status === 'active').length} active · ${customers.filter(c => c.status === 'potential').length} potential`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => {
              const fmt = e.target.value as 'pdf' | 'csv';
              if (fmt === 'pdf') exportCustomersToPdf(exportList);
              else exportCustomersToCsv(exportList);
              setExportFormat('pdf');
            }}
            disabled={loading || exportList.length === 0}
            className="h-9 w-36 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Export customers"
          >
            <option value="pdf">Export PDF</option>
            <option value="csv">Export CSV</option>
          </select>
          <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh" disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {!isRestricted && (
            <Button variant="primary" onClick={openAdd} leftIcon={<Plus className="size-4" />}>
              Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          leftIcon={<Search className="size-3.5" />}
          placeholder={`Filter ${entityLabelPlural.toLowerCase()}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={`Filter ${entityLabelPlural.toLowerCase()}`}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as typeof groupFilter)}
          className="h-9 w-44 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          aria-label="Customer group"
        >
          <option value="all">All groups</option>
          <option value="active">Active</option>
          {!isRestricted && <option value="potential">Potential</option>}
          {!isRestricted && <option value="archived">Archived</option>}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={reload} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Sections */}
      {!loading && (
        <>
          {(groupFilter === 'all' || groupFilter === 'active') && (
            <CustomerSection
              title="Active"
              customers={active}
              onEdit={openEdit}
              onView={handleView}
              defaultOpen
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          )}
          {!isRestricted && (groupFilter === 'all' || groupFilter === 'potential') && (
            <CustomerSection
              title="Potential"
              customers={potential}
              onEdit={openEdit}
              onView={handleView}
              defaultOpen
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          )}
          {!isRestricted && (groupFilter === 'all' || groupFilter === 'archived') && (
            <CustomerSection
              title="Archived"
              customers={archived}
              onEdit={openEdit}
              onView={handleView}
              defaultOpen={false}
              collapsible
              archived
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          )}
        </>
      )}

      {/* Add / Edit modal */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={async data => {
          if (editing) {
            await editCustomer(editing.id, data);
          } else {
            await addCustomer(data);
          }
        }}
        initial={editing}
      />
    </div>
  );
}
