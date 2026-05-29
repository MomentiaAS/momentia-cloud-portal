import { useMemo, useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, Trash2, ChevronDown, ChevronUp, ChevronsUpDown, Filter, Pencil, SlidersHorizontal } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useWorkTimeEntries } from '../../hooks/useWorkTimeEntries';
import { useActiveWorkTimer, type TimerSlotIndex } from '../../hooks/useActiveWorkTimer';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { cn } from '../../components/ui/cn';
import type { WorkTimeEntry, WorkTimeSource, Customer } from '../../types';

const inputClass = cn(
  'h-11 md:h-9 w-full rounded-lg border border-border bg-surface px-3 text-base md:text-sm text-text-primary',
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
  'disabled:opacity-50 transition-colors',
);

/** In `logCustomerFilterIds`, marks internal (no client) rows. */
const INTERNAL_CUSTOMER_FILTER_KEY = '__internal__';

function entryDurationMs(e: WorkTimeEntry): number {
  return Math.max(0, new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime());
}

function totalDurationMs(rows: WorkTimeEntry[]): number {
  return rows.reduce((a, e) => a + entryDurationMs(e), 0);
}

function entryMatchesCustomerFilter(e: WorkTimeEntry, filterIds: string[] | null): boolean {
  if (filterIds == null) return true;
  if (filterIds.length === 0) return false;
  const wantInternal = filterIds.includes(INTERNAL_CUSTOMER_FILTER_KEY);
  const idSet = new Set(filterIds.filter(x => x !== INTERNAL_CUSTOMER_FILTER_KEY));
  if (e.customerId == null) return wantInternal;
  return idSet.has(e.customerId);
}

function toggleCustomerFilterId(current: string[] | null, id: string): string[] | null {
  if (current == null) return [id];
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  const arr = [...next];
  return arr.length === 0 ? null : arr;
}

function localDateInputValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Value for `<input type="datetime-local" />` in the browser's local zone. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isStaffRole(role: string | undefined): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'technician';
}

function customerLabel(map: Map<string, string>, customerId: string | null): string {
  if (customerId == null) return 'Internal';
  return map.get(customerId) ?? '—';
}

type TimeLogSortKey = 'when' | 'duration' | 'client' | 'notes' | 'source';
type TimeLogSortDir = 'asc' | 'desc';

function compareLogRows(
  a: WorkTimeEntry,
  b: WorkTimeEntry,
  customerNameById: Map<string, string>,
  sortKey: TimeLogSortKey,
  dir: number,
): number {
  let cmp = 0;
  switch (sortKey) {
    case 'when':
      cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      break;
    case 'duration': {
      const da = new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime();
      const db = new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime();
      cmp = da - db;
      break;
    }
    case 'client':
      cmp = customerLabel(customerNameById, a.customerId).localeCompare(
        customerLabel(customerNameById, b.customerId),
        undefined,
        { sensitivity: 'base' },
      );
      break;
    case 'notes':
      cmp = (a.notes || '').localeCompare(b.notes || '', undefined, { sensitivity: 'base' });
      break;
    case 'source':
      cmp = a.source.localeCompare(b.source);
      break;
  }
  return dir * cmp;
}

/** Not invoiced first (normal), invoiced last (grayed in UI); within each group, column sort applies. */
function sortWorkTimeEntries(
  list: WorkTimeEntry[],
  customerNameById: Map<string, string>,
  sortKey: TimeLogSortKey,
  sortDir: TimeLogSortDir,
): WorkTimeEntry[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const cmp = (a: WorkTimeEntry, b: WorkTimeEntry) =>
    compareLogRows(a, b, customerNameById, sortKey, dir);
  const open = list.filter(e => !e.invoicedAt);
  const billed = list.filter(e => !!e.invoicedAt);
  open.sort(cmp);
  billed.sort(cmp);
  return [...open, ...billed];
}

function manualWindowFromTimes(
  workDate: string,
  startTime: string,
  endTime: string,
):
  | { ok: true; hours: number; minutes: number; startedAt: string; endedAt: string }
  | { ok: false; message: string } {
  const localStart = new Date(`${workDate}T${startTime}:00`);
  let localEnd = new Date(`${workDate}T${endTime}:00`);
  if (Number.isNaN(localStart.getTime()) || Number.isNaN(localEnd.getTime())) {
    return { ok: false, message: 'Invalid date or time.' };
  }
  if (localEnd.getTime() === localStart.getTime()) {
    return { ok: false, message: 'Start and end time must differ.' };
  }
  if (localEnd.getTime() < localStart.getTime()) {
    localEnd = new Date(localEnd.getTime() + 24 * 60 * 60 * 1000);
  }
  const ms = localEnd.getTime() - localStart.getTime();
  const totalMin = Math.round(ms / 60_000);
  if (totalMin <= 0) {
    return { ok: false, message: 'End time must be after start time (same day, or end past midnight).' };
  }
  return {
    ok: true,
    hours: Math.floor(totalMin / 60),
    minutes: totalMin % 60,
    startedAt: localStart.toISOString(),
    endedAt: localEnd.toISOString(),
  };
}

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function invoicedLabel(iso: string | null): string {
  if (!iso) return '';
  return format(new Date(iso), 'yyyy-MM-dd');
}

function sanitizeExportFilenamePart(s: string): string {
  return s.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'export';
}

function exportFilenameStem(
  filterIds: string[],
  customerNameById: Map<string, string>,
): string {
  const ids = filterIds.filter(x => x !== INTERNAL_CUSTOMER_FILTER_KEY);
  const hasInternal = filterIds.includes(INTERNAL_CUSTOMER_FILTER_KEY);
  if (ids.length === 1 && !hasInternal) {
    const name = customerNameById.get(ids[0]) ?? 'client';
    return `time_entries_${sanitizeExportFilenamePart(name)}`;
  }
  if (ids.length === 0 && hasInternal) return 'time_entries_internal';
  return 'time_entries_selected';
}

type ExportTimeEntriesOpts = {
  filenameStem: string;
  /** Omit invoiced column (billing export of open lines only). */
  billingOnly?: boolean;
};

function exportTimeEntriesToCsv(
  rows: WorkTimeEntry[],
  customerNameById: Map<string, string>,
  opts: ExportTimeEntriesOpts,
) {
  const header = opts.billingOnly
    ? ['Started', 'Ended', 'Duration', 'Client', 'Notes', 'Source']
    : ['Started', 'Ended', 'Duration', 'Client', 'Notes', 'Source', 'Invoiced at'];
  const body = rows.map(e => {
    const dur = new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime();
    const cols = [
      format(new Date(e.startedAt), 'yyyy-MM-dd HH:mm'),
      format(new Date(e.endedAt), 'yyyy-MM-dd HH:mm'),
      formatDurationMs(dur),
      customerLabel(customerNameById, e.customerId),
      e.notes,
      e.source,
    ];
    if (!opts.billingOnly) cols.push(invoicedLabel(e.invoicedAt) || '—');
    return cols.map(csvEscape);
  });
  const csv = ['\uFEFF' + header.join(','), ...body.map(r => r.join(','))].join('\n');
  const totalMs = totalDurationMs(rows);
  const totalPad = opts.billingOnly ? ['', ''] : ['', '', ''];
  const totalLine = ['', '', formatDurationMs(totalMs), 'Total (this export)', ...totalPad]
    .map(csvEscape)
    .join(',');
  downloadTextFile(`${opts.filenameStem}_${Date.now()}.csv`, `${csv}\n${totalLine}`, 'text/csv;charset=utf-8');
}

function exportTimeEntriesToPdf(
  rows: WorkTimeEntry[],
  customerNameById: Map<string, string>,
  opts: ExportTimeEntriesOpts,
) {
  const now = new Date().toLocaleString();
  const tableRows = rows
    .map(e => {
      const dur = new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime();
      const client = escapeHtml(customerLabel(customerNameById, e.customerId));
      const invoicedCell = opts.billingOnly
        ? ''
        : `<td>${escapeHtml(invoicedLabel(e.invoicedAt) || '—')}</td>`;
      return `
    <tr>
      <td>${escapeHtml(format(new Date(e.startedAt), 'yyyy-MM-dd HH:mm'))}</td>
      <td>${escapeHtml(format(new Date(e.endedAt), 'yyyy-MM-dd HH:mm'))}</td>
      <td>${escapeHtml(formatDurationMs(dur))}</td>
      <td>${client}</td>
      <td>${escapeHtml(e.notes)}</td>
      <td>${escapeHtml(e.source)}</td>
      ${invoicedCell}
    </tr>`;
    })
    .join('');

  const totalMs = totalDurationMs(rows);
  const totalColspan = opts.billingOnly ? 3 : 4;
  const totalRow = `
    <tr class="total">
      <td colspan="2"></td>
      <td>${escapeHtml(formatDurationMs(totalMs))}</td>
      <td colspan="${totalColspan}">Total (this export)</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Time entries — ${escapeHtml(now)}</title>
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
    tr.total td { border-top: 2px solid #d1d5db; font-weight: 600; }
    @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
  </style>
</head>
<body>
  <h1>Time entries</h1>
  <p class="meta">Exported ${escapeHtml(now)} · ${opts.billingOnly ? 'Not yet invoiced · ' : ''}${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}</p>
  <table>
    <thead>
      <tr>
        <th>Started</th><th>Ended</th><th>Duration</th><th>Client</th><th>Notes</th><th>Source</th>${opts.billingOnly ? '' : '<th>Invoiced at</th>'}
      </tr>
    </thead>
    <tbody>${tableRows}${totalRow}</tbody>
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

type TimerDraft = { customer: string; notes: string };

function EditTimeEntryModal({
  entry,
  customers,
  onClose,
  onSave,
  onSaved,
}: {
  entry: WorkTimeEntry;
  customers: Customer[];
  onClose: () => void;
  onSave: (payload: {
    customerId: string | null;
    startedAt: string;
    endedAt: string;
    notes: string;
    source: WorkTimeSource;
  }) => Promise<void>;
  onSaved: () => void;
}) {
  const [startLocal, setStartLocal] = useState(() => toDatetimeLocalValue(entry.startedAt));
  const [endLocal, setEndLocal] = useState(() => toDatetimeLocalValue(entry.endedAt));
  const [customer, setCustomer] = useState(entry.customerId ?? '');
  const [notes, setNotes] = useState(entry.notes);
  const [source, setSource] = useState<WorkTimeSource>(entry.source);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStartLocal(toDatetimeLocalValue(entry.startedAt));
    setEndLocal(toDatetimeLocalValue(entry.endedAt));
    setCustomer(entry.customerId ?? '');
    setNotes(entry.notes);
    setSource(entry.source);
    setFormError(null);
  }, [entry]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const s = new Date(startLocal);
    const en = new Date(endLocal);
    if (!startLocal || !endLocal || Number.isNaN(s.getTime()) || Number.isNaN(en.getTime())) {
      setFormError('Enter valid start and end date-times.');
      return;
    }
    if (en.getTime() <= s.getTime()) {
      setFormError('End must be after start.');
      return;
    }
    try {
      setSaving(true);
      await onSave({
        customerId: customer === '' ? null : customer,
        startedAt: s.toISOString(),
        endedAt: en.toISOString(),
        notes,
        source,
      });
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  const customersSorted = [...customers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  return (
    <Modal
      open
      title="Edit time entry"
      onClose={() => {
        if (!saving) onClose();
      }}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-time-entry-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-time-entry-form" onSubmit={e => void handleSubmit(e)} className="space-y-4">
        {formError && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="size-3.5 shrink-0" />
            {formError}
          </p>
        )}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="edit-start">
            Start
          </label>
          <input
            id="edit-start"
            type="datetime-local"
            className={inputClass}
            value={startLocal}
            onChange={e => setStartLocal(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="edit-end">
            End
          </label>
          <input
            id="edit-end"
            type="datetime-local"
            className={inputClass}
            value={endLocal}
            onChange={e => setEndLocal(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="edit-client">
            Client
          </label>
          <select
            id="edit-client"
            className={inputClass}
            value={customer}
            onChange={e => setCustomer(e.target.value)}
          >
            <option value="">No client / internal</option>
            {customersSorted.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="edit-source">
            Source
          </label>
          <select
            id="edit-source"
            className={inputClass}
            value={source}
            onChange={e => setSource(e.target.value as WorkTimeSource)}
          >
            <option value="timer">Timer</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}

export function TimeTrackingPage() {
  const { profile } = useAuth();
  const { customers, loading: customersLoading } = useCustomers();
  const { entries, loading: entriesLoading, error: entriesError, addEntry, removeEntry, reload, setEntryInvoiced, updateEntry } =
    useWorkTimeEntries();
  const timer = useActiveWorkTimer();

  const [timerDrafts, setTimerDrafts] = useState<[TimerDraft, TimerDraft]>([
    { customer: '', notes: '' },
    { customer: '', notes: '' },
  ]);
  const [timerActionError, setTimerActionError] = useState<string | null>(null);
  const [timerBusySlot, setTimerBusySlot] = useState<TimerSlotIndex | null>(null);

  const [manualDate, setManualDate] = useState(() => localDateInputValue());
  const [manualStartTime, setManualStartTime] = useState('09:00');
  const [manualEndTime, setManualEndTime] = useState('10:00');
  const [manualCustomer, setManualCustomer] = useState<string>('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorkTimeEntry | null>(null);
  const [invoicedSavingId, setInvoicedSavingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [customerFilterOpen, setCustomerFilterOpen] = useState(false);
  const [logFiltersOpen, setLogFiltersOpen] = useState(false);
  const customerFilterRef = useRef<HTMLDivElement | null>(null);

  const [logCustomerFilterIds, setLogCustomerFilterIds] = useState<string[] | null>(null);

  const [logSortKey, setLogSortKey] = useState<TimeLogSortKey>('when');
  const [logSortDir, setLogSortDir] = useState<TimeLogSortDir>('desc');

  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) m.set(c.id, c.name);
    return m;
  }, [customers]);

  const filteredLogEntries = useMemo(
    () => entries.filter(e => entryMatchesCustomerFilter(e, logCustomerFilterIds)),
    [entries, logCustomerFilterIds],
  );

  const sortedLogEntries = useMemo(
    () => sortWorkTimeEntries(filteredLogEntries, customerNameById, logSortKey, logSortDir),
    [filteredLogEntries, customerNameById, logSortKey, logSortDir],
  );

  const hasClientFilter = logCustomerFilterIds != null && logCustomerFilterIds.length > 0;

  const exportLogEntries = useMemo(() => {
    const open = filteredLogEntries.filter(e => !e.invoicedAt);
    return sortWorkTimeEntries(open, customerNameById, logSortKey, logSortDir);
  }, [filteredLogEntries, customerNameById, logSortKey, logSortDir]);

  const exportLogOpts = useMemo((): ExportTimeEntriesOpts | null => {
    if (!hasClientFilter || !logCustomerFilterIds) return null;
    return {
      filenameStem: exportFilenameStem(logCustomerFilterIds, customerNameById),
      billingOnly: true,
    };
  }, [hasClientFilter, logCustomerFilterIds, customerNameById]);

  const canExportLog = exportLogOpts != null && exportLogEntries.length > 0;

  const exportDisabledReason = !hasClientFilter
    ? 'Select one or more clients under Your log to export uninvoiced time.'
    : exportLogEntries.length === 0
      ? 'No uninvoiced entries for the selected client(s).'
      : undefined;

  const logTotalMs = useMemo(() => totalDurationMs(sortedLogEntries), [sortedLogEntries]);
  const logUninvoicedTotalMs = useMemo(() => totalDurationMs(exportLogEntries), [exportLogEntries]);

  const customersSorted = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [customers],
  );

  const onLogSort = useCallback((next: TimeLogSortKey) => {
    setLogSortKey(prevKey => {
      if (prevKey === next) {
        setLogSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setLogSortDir('asc');
      return next;
    });
  }, []);

  const manualDerived = useMemo(
    () => manualWindowFromTimes(manualDate, manualStartTime, manualEndTime),
    [manualDate, manualStartTime, manualEndTime],
  );

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (exportRef.current && !exportRef.current.contains(t)) setExportOpen(false);
      if (customerFilterRef.current && !customerFilterRef.current.contains(t)) setCustomerFilterOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const setDraft = useCallback((slot: TimerSlotIndex, patch: Partial<TimerDraft>) => {
    setTimerDrafts(prev => {
      const next: [TimerDraft, TimerDraft] = [{ ...prev[0] }, { ...prev[1] }];
      next[slot] = { ...next[slot], ...patch };
      return next;
    });
  }, []);

  const handleStartTimer = useCallback(
    (slot: TimerSlotIndex) => {
      setTimerActionError(null);
      const d = timerDrafts[slot];
      const cid = d.customer === '' ? null : d.customer;
      if (!timer.start(slot, cid, d.notes)) {
        setTimerActionError(`Timer ${slot + 1} is already running.`);
      }
    },
    [timer, timerDrafts],
  );

  const handleStopTimer = useCallback(
    async (slot: TimerSlotIndex) => {
      const active = timer.slots[slot];
      if (!active) return;
      const { customerId, startedAtIso, notes } = active;
      const endedAtIso = new Date().toISOString();
      if (new Date(endedAtIso).getTime() <= new Date(startedAtIso).getTime()) {
        setTimerActionError('Invalid timer range.');
        return;
      }
      setTimerBusySlot(slot);
      setTimerActionError(null);
      try {
        await addEntry({
          customerId,
          startedAt: startedAtIso,
          endedAt: endedAtIso,
          notes,
          source: 'timer',
        });
        timer.discard(slot);
      } catch (e) {
        setTimerActionError(e instanceof Error ? e.message : 'Could not save entry.');
      } finally {
        setTimerBusySlot(null);
      }
    },
    [timer, addEntry],
  );

  const handleManualSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setManualError(null);
      if (!manualDerived.ok) {
        setManualError(manualDerived.message);
        return;
      }

      setManualBusy(true);
      try {
        await addEntry({
          customerId: manualCustomer === '' ? null : manualCustomer,
          startedAt: manualDerived.startedAt,
          endedAt: manualDerived.endedAt,
          notes: manualNotes,
          source: 'manual',
        });
        setManualNotes('');
        setManualError(null);
      } catch (err) {
        setManualError(err instanceof Error ? err.message : 'Could not save entry.');
      } finally {
        setManualBusy(false);
      }
    },
    [manualDerived, manualCustomer, manualNotes, addEntry],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this time entry?')) return;
      setDeleteId(id);
      try {
        await removeEntry(id);
      } catch {
        window.alert('Could not delete entry. Try again.');
      } finally {
        setDeleteId(null);
      }
    },
    [removeEntry],
  );

  const handleInvoicedChange = useCallback(
    async (id: string, invoiced: boolean) => {
      setInvoicedSavingId(id);
      try {
        await setEntryInvoiced(id, invoiced);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Could not update invoice status.');
      } finally {
        setInvoicedSavingId(null);
      }
    },
    [setEntryInvoiced],
  );

  if (!isStaffRole(profile?.role)) {
    return <Navigate to="/" replace />;
  }

  const loading = customersLoading || entriesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Time</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Up to two live timers; manual entries from start and end time. Times use your computer&apos;s local
            timezone.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div ref={exportRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(v => !v)}
              disabled={loading}
              title={exportDisabledReason}
              rightIcon={<ChevronDown className="size-3.5" />}
            >
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-surface-raised border border-border rounded-lg shadow-popover z-20 py-1">
                {!canExportLog ? (
                  <p className="px-3 py-2 text-xs text-text-muted leading-snug">
                    {exportDisabledReason ?? 'Nothing to export.'}
                  </p>
                ) : (
                  <>
                    <p className="px-3 py-2 text-xs text-text-muted border-b border-border leading-snug">
                      Uninvoiced lines for selected client(s) only ({exportLogEntries.length}).
                    </p>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                      onClick={() => {
                        if (!exportLogOpts) return;
                        exportTimeEntriesToPdf(exportLogEntries, customerNameById, exportLogOpts);
                        setExportOpen(false);
                      }}
                    >
                      Export to PDF
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                      onClick={() => {
                        if (!exportLogOpts) return;
                        exportTimeEntriesToCsv(exportLogEntries, customerNameById, exportLogOpts);
                        setExportOpen(false);
                      }}
                    >
                      Export to CSV
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            Refresh list
          </Button>
        </div>
      </div>

      {(entriesError || timerActionError) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div>
            {entriesError && <p>{entriesError}</p>}
            {timerActionError && <p>{timerActionError}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Timers" subtitle="Run up to two at once — each saves separately" />
          <CardBody className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-border">
            {([0, 1] as const).map(slot => (
              <div
                key={slot}
                className={cn('space-y-4', slot === 0 ? 'md:pr-6' : 'md:pl-6')}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Timer {slot + 1}</p>
                {timer.slots[slot] ? (
                  <>
                    <div className="rounded-lg bg-primary-100/80 dark:bg-primary-900/30 px-3 py-4 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Elapsed</p>
                      <p className="text-2xl font-mono font-semibold text-text-primary tabular-nums mt-1">
                        {formatDurationMs(timer.elapsedMsPair[slot])}
                      </p>
                      <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                        {customerLabel(customerNameById, timer.slots[slot]!.customerId)}
                        {timer.slots[slot]!.notes ? ` · ${timer.slots[slot]!.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleStopTimer(slot)}
                        loading={timerBusySlot === slot}
                      >
                        Stop &amp; save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Discard timer ${slot + 1} without saving?`)) timer.discard(slot);
                        }}
                        disabled={timerBusySlot === slot}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label
                        className="block text-xs font-medium text-text-secondary mb-1"
                        htmlFor={`timer-${slot}-customer`}
                      >
                        Client
                      </label>
                      <select
                        id={`timer-${slot}-customer`}
                        className={inputClass}
                        value={timerDrafts[slot].customer}
                        onChange={e => setDraft(slot, { customer: e.target.value })}
                      >
                        <option value="">No client / internal</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Notes (optional)"
                      placeholder="What are you working on?"
                      value={timerDrafts[slot].notes}
                      onChange={e => setDraft(slot, { notes: e.target.value })}
                    />
                    <Button variant="primary" size="sm" onClick={() => handleStartTimer(slot)}>
                      Start timer
                    </Button>
                  </>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Manual entry" subtitle="Set start and end time — duration updates automatically" />
          <CardBody>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {manualError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {manualError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="manual-date">
                    Work date
                  </label>
                  <input
                    id="manual-date"
                    type="date"
                    className={inputClass}
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="manual-start">
                    Start time
                  </label>
                  <input
                    id="manual-start"
                    type="time"
                    className={inputClass}
                    value={manualStartTime}
                    onChange={e => setManualStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="manual-end">
                    End time
                  </label>
                  <input
                    id="manual-end"
                    type="time"
                    className={inputClass}
                    value={manualEndTime}
                    onChange={e => setManualEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Hours (from times)"
                  type="text"
                  readOnly
                  disabled
                  value={manualDerived.ok ? String(manualDerived.hours) : '—'}
                />
                <Input
                  label="Minutes (from times)"
                  type="text"
                  readOnly
                  disabled
                  value={manualDerived.ok ? String(manualDerived.minutes) : '—'}
                />
              </div>
              {!manualDerived.ok && (
                <p className="text-xs text-text-muted">{manualDerived.message}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="manual-customer">
                  Client
                </label>
                <select
                  id="manual-customer"
                  className={inputClass}
                  value={manualCustomer}
                  onChange={e => setManualCustomer(e.target.value)}
                >
                  <option value="">No client / internal</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Notes (optional)"
                placeholder="What did you work on?"
                value={manualNotes}
                onChange={e => setManualNotes(e.target.value)}
              />
              <Button type="submit" variant="secondary" loading={manualBusy} disabled={!manualDerived.ok}>
                Add entry
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Your log"
          subtitle="Filter by client to export uninvoiced time (PDF/CSV). Not invoiced on top; invoiced lines grayed at the bottom. Sort headers apply within each group."
        />
        <CardBody className="p-0 sm:px-0">
          {loading ? (
            <div className="px-5 pb-5 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-text-muted">No entries yet. Use the timers or manual form above.</p>
          ) : (
            <>
              <div className="px-4 sm:px-5 py-3 border-b border-border flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden"
                  leftIcon={<SlidersHorizontal className="size-3.5" />}
                  onClick={() => setLogFiltersOpen(true)}
                >
                  Clients
                  {logCustomerFilterIds != null && logCustomerFilterIds.length > 0
                    ? ` (${logCustomerFilterIds.length})`
                    : ''}
                </Button>
                <div ref={customerFilterRef} className="relative hidden md:block">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerFilterOpen(v => !v)}
                    leftIcon={<Filter className="size-3.5" />}
                    rightIcon={<ChevronDown className="size-3.5" />}
                  >
                    Clients
                    {logCustomerFilterIds != null && logCustomerFilterIds.length > 0
                      ? ` (${logCustomerFilterIds.length})`
                      : ''}
                  </Button>
                  {customerFilterOpen && (
                    <div className="absolute left-0 mt-1 min-w-[14rem] max-w-[min(22rem,85vw)] max-h-72 overflow-y-auto bg-surface-raised border border-border rounded-lg shadow-popover z-30 py-2 px-1 space-y-0.5">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-text-secondary rounded-md hover:bg-primary-100 dark:hover:bg-primary-700/40"
                        onClick={() => {
                          setLogCustomerFilterIds(null);
                          setCustomerFilterOpen(false);
                        }}
                      >
                        Show all clients
                      </button>
                      <div className="border-t border-border my-1" />
                      <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-md hover:bg-primary-100 dark:hover:bg-primary-700/40">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border text-accent shrink-0"
                          checked={logCustomerFilterIds?.includes(INTERNAL_CUSTOMER_FILTER_KEY) ?? false}
                          onChange={() =>
                            setLogCustomerFilterIds(prev =>
                              toggleCustomerFilterId(prev, INTERNAL_CUSTOMER_FILTER_KEY),
                            )
                          }
                        />
                        <span>Internal (no client)</span>
                      </label>
                      {customersSorted.map(c => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded-md hover:bg-primary-100 dark:hover:bg-primary-700/40"
                        >
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border text-accent shrink-0"
                            checked={logCustomerFilterIds?.includes(c.id) ?? false}
                            onChange={() =>
                              setLogCustomerFilterIds(prev => toggleCustomerFilterId(prev, c.id))
                            }
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary tabular-nums">{formatDurationMs(logTotalMs)}</span>
                  {' · '}
                  {sortedLogEntries.length} entr{sortedLogEntries.length !== 1 ? 'ies' : 'y'}
                  {hasClientFilter && (
                    <>
                      {' · '}
                      <span className="font-medium text-text-primary tabular-nums">
                        {formatDurationMs(logUninvoicedTotalMs)}
                      </span>
                      {' uninvoiced'}
                      <span className="text-text-muted"> (filtered)</span>
                    </>
                  )}
                </p>
                {logCustomerFilterIds != null && (
                  <Button variant="ghost" size="sm" onClick={() => setLogCustomerFilterIds(null)}>
                    Clear client filter
                  </Button>
                )}
              </div>

              <Sheet open={logFiltersOpen} onClose={() => setLogFiltersOpen(false)} title="Filter by client">
                <div className="space-y-3">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm rounded-lg border border-border hover:bg-primary-100 dark:hover:bg-primary-700/40"
                    onClick={() => { setLogCustomerFilterIds(null); setLogFiltersOpen(false); }}
                  >
                    Show all clients
                  </button>
                  <label className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-5 rounded border-border text-accent shrink-0"
                      checked={logCustomerFilterIds?.includes(INTERNAL_CUSTOMER_FILTER_KEY) ?? false}
                      onChange={() =>
                        setLogCustomerFilterIds(prev =>
                          toggleCustomerFilterId(prev, INTERNAL_CUSTOMER_FILTER_KEY),
                        )
                      }
                    />
                    Internal (no client)
                  </label>
                  {customersSorted.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border border-border cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="size-5 rounded border-border text-accent shrink-0"
                        checked={logCustomerFilterIds?.includes(c.id) ?? false}
                        onChange={() =>
                          setLogCustomerFilterIds(prev => toggleCustomerFilterId(prev, c.id))
                        }
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                  <Button variant="primary" className="w-full" onClick={() => setLogFiltersOpen(false)}>
                    Done
                  </Button>
                </div>
              </Sheet>

              {sortedLogEntries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-text-muted text-center">
                  No entries match the current client selection. Change the checkboxes under Clients or choose
                  &quot;Show all clients&quot;.
                </p>
              ) : (
                <>
                <div className="md:hidden">
                  {sortedLogEntries.map(row => (
                    <TimeMobileCard
                      key={row.id}
                      row={row}
                      clientName={customerLabel(customerNameById, row.customerId)}
                      onEdit={() => setEditingEntry(row)}
                      onDelete={() => void handleDelete(row.id)}
                      deleting={deleteId === row.id}
                      invoicedSaving={invoicedSavingId === row.id}
                      onInvoicedChange={invoiced => void handleInvoicedChange(row.id, invoiced)}
                    />
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <th className="px-3 py-3 w-[8.5rem] font-semibold">Invoiced</th>
                        <LogSortTh
                          column="when"
                          label="When"
                          currentKey={logSortKey}
                          currentDir={logSortDir}
                          onSort={onLogSort}
                          className="px-5"
                        />
                        <LogSortTh
                          column="duration"
                          label="Duration"
                          currentKey={logSortKey}
                          currentDir={logSortDir}
                          onSort={onLogSort}
                          className="px-3"
                        />
                        <LogSortTh
                          column="client"
                          label="Client"
                          currentKey={logSortKey}
                          currentDir={logSortDir}
                          onSort={onLogSort}
                          className="px-3"
                        />
                        <LogSortTh
                          column="notes"
                          label="Notes"
                          currentKey={logSortKey}
                          currentDir={logSortDir}
                          onSort={onLogSort}
                          className="px-3"
                        />
                        <LogSortTh
                          column="source"
                          label="Source"
                          currentKey={logSortKey}
                          currentDir={logSortDir}
                          onSort={onLogSort}
                          className="px-3"
                        />
                        <th className="px-5 py-3 w-[5.5rem]" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLogEntries.map(row => (
                        <TimeRow
                          key={row.id}
                          row={row}
                          clientName={customerLabel(customerNameById, row.customerId)}
                          onEdit={() => setEditingEntry(row)}
                          onDelete={() => void handleDelete(row.id)}
                          deleting={deleteId === row.id}
                          invoicedSaving={invoicedSavingId === row.id}
                          onInvoicedChange={invoiced => void handleInvoicedChange(row.id, invoiced)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </>
          )}
        </CardBody>
      </Card>
      {editingEntry && (
        <EditTimeEntryModal
          entry={editingEntry}
          customers={customers}
          onClose={() => setEditingEntry(null)}
          onSave={async payload => {
            await updateEntry(editingEntry.id, payload);
          }}
          onSaved={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

function LogSortTh({
  column,
  label,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  column: TimeLogSortKey;
  label: string;
  currentKey: TimeLogSortKey;
  currentDir: TimeLogSortDir;
  onSort: (k: TimeLogSortKey) => void;
  className?: string;
}) {
  const active = currentKey === column;
  return (
    <th className={cn('py-3', className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1.5 transition-colors text-left w-full',
          active ? 'text-accent' : 'text-text-muted hover:text-text-primary',
        )}
      >
        <span>{label}</span>
        {active
          ? (currentDir === 'asc' ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />)
          : <ChevronsUpDown className="size-3 shrink-0 opacity-60" />}
      </button>
    </th>
  );
}

function formatWhenMobile(startedAt: string, endedAt: string): string {
  const s = new Date(startedAt);
  const e = new Date(endedAt);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${format(s, 'd MMM')} · ${format(s, 'p')} – ${format(e, 'p')}`;
  }
  return `${format(s, 'd MMM p')} – ${format(e, 'd MMM p')}`;
}

function TimeMobileCard({
  row,
  clientName,
  onEdit,
  onDelete,
  deleting,
  invoicedSaving,
  onInvoicedChange,
}: {
  row: WorkTimeEntry;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  invoicedSaving: boolean;
  onInvoicedChange: (invoiced: boolean) => void;
}) {
  const durationMs = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
  const isInvoiced = !!row.invoicedAt;
  return (
    <div
      className={cn(
        'px-4 py-3.5 border-b border-border',
        isInvoiced && 'bg-primary-50/70 dark:bg-primary-900/25 opacity-90',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="size-5 mt-0.5 rounded border-border text-accent shrink-0"
          checked={isInvoiced}
          disabled={invoicedSaving}
          onChange={e => onInvoicedChange(e.target.checked)}
          aria-label={isInvoiced ? 'Invoiced' : 'Mark as invoiced'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold tabular-nums text-text-primary">{formatDurationMs(durationMs)}</p>
            <span className={cn(
              'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded',
              row.source === 'timer' ? 'bg-accent/15 text-accent' : 'bg-primary-200/60 dark:bg-primary-700/50 text-text-secondary',
            )}>
              {row.source === 'timer' ? 'Timer' : 'Manual'}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">{clientName}</p>
          <p className="text-xs text-text-muted mt-1">{formatWhenMobile(row.startedAt, row.endedAt)}</p>
          {row.notes && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{row.notes}</p>}
          {isInvoiced && row.invoicedAt && (
            <p className="text-[10px] text-text-muted mt-1">Invoiced {format(new Date(row.invoicedAt), 'PP')}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-1 mt-2">
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="Edit entry">
          <Pencil className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} loading={deleting} aria-label="Delete entry">
          <Trash2 className="size-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function TimeRow({
  row,
  clientName,
  onEdit,
  onDelete,
  deleting,
  invoicedSaving,
  onInvoicedChange,
}: {
  row: WorkTimeEntry;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  invoicedSaving: boolean;
  onInvoicedChange: (invoiced: boolean) => void;
}) {
  const durationMs = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
  const when = `${format(new Date(row.startedAt), 'PPp')} – ${format(new Date(row.endedAt), 'p')}`;
  const isInvoiced = !!row.invoicedAt;
  return (
    <tr
      className={cn(
        'border-b border-border last:border-0',
        isInvoiced
          ? 'bg-primary-50/70 dark:bg-primary-900/25 text-text-muted opacity-80'
          : 'hover:bg-primary-50/50 dark:hover:bg-primary-900/20 text-text-primary',
      )}
    >
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-1.5">
          <input
            type="checkbox"
            className="size-4 rounded border-border text-accent focus:ring-accent shrink-0"
            checked={isInvoiced}
            disabled={invoicedSaving}
            onChange={e => onInvoicedChange(e.target.checked)}
            aria-label={isInvoiced ? 'Invoiced — uncheck if not billed' : 'Mark as invoiced'}
          />
          {isInvoiced && row.invoicedAt && (
            <span className="text-[10px] leading-tight text-text-muted max-w-[7.5rem]">
              {format(new Date(row.invoicedAt), 'PP')}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 whitespace-nowrap">{when}</td>
      <td className="px-3 py-3 font-medium tabular-nums">{formatDurationMs(durationMs)}</td>
      <td className="px-3 py-3 text-text-secondary">{clientName}</td>
      <td className="px-3 py-3 text-text-secondary max-w-[200px] sm:max-w-xs truncate" title={row.notes}>
        {row.notes || '—'}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
            row.source === 'timer'
              ? 'bg-accent/15 text-accent'
              : 'bg-primary-200/60 dark:bg-primary-700/50 text-text-primary',
          )}
        >
          {row.source === 'timer' ? 'Timer' : 'Manual'}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-text-muted hover:text-accent"
            aria-label="Edit entry"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-text-muted hover:text-red-600"
            aria-label="Delete entry"
            onClick={onDelete}
            loading={deleting}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
