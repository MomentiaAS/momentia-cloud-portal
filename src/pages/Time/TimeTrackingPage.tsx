import { useMemo, useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, Trash2, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useWorkTimeEntries } from '../../hooks/useWorkTimeEntries';
import { useActiveWorkTimer, type TimerSlotIndex } from '../../hooks/useActiveWorkTimer';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { cn } from '../../components/ui/cn';
import type { WorkTimeEntry } from '../../types';

const inputClass = cn(
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
  'disabled:opacity-50 transition-colors',
);

function localDateInputValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function sortWorkTimeEntries(
  list: WorkTimeEntry[],
  customerNameById: Map<string, string>,
  sortKey: TimeLogSortKey,
  sortDir: TimeLogSortDir,
): WorkTimeEntry[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
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
  });
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

function exportTimeEntriesToCsv(
  rows: WorkTimeEntry[],
  customerNameById: Map<string, string>,
) {
  const header = ['Started', 'Ended', 'Duration', 'Client', 'Notes', 'Source'];
  const body = rows.map(e => {
    const dur = new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime();
    return [
      format(new Date(e.startedAt), 'yyyy-MM-dd HH:mm'),
      format(new Date(e.endedAt), 'yyyy-MM-dd HH:mm'),
      formatDurationMs(dur),
      customerLabel(customerNameById, e.customerId),
      e.notes,
      e.source,
    ].map(csvEscape);
  });
  const csv = ['\uFEFF' + header.join(','), ...body.map(r => r.join(','))].join('\n');
  downloadTextFile(`time_entries_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
}

function exportTimeEntriesToPdf(
  rows: WorkTimeEntry[],
  customerNameById: Map<string, string>,
) {
  const now = new Date().toLocaleString();
  const tableRows = rows
    .map(e => {
      const dur = new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime();
      const client = escapeHtml(customerLabel(customerNameById, e.customerId));
      return `
    <tr>
      <td>${escapeHtml(format(new Date(e.startedAt), 'yyyy-MM-dd HH:mm'))}</td>
      <td>${escapeHtml(format(new Date(e.endedAt), 'yyyy-MM-dd HH:mm'))}</td>
      <td>${escapeHtml(formatDurationMs(dur))}</td>
      <td>${client}</td>
      <td>${escapeHtml(e.notes)}</td>
      <td>${escapeHtml(e.source)}</td>
    </tr>`;
    })
    .join('');

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
    @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
  </style>
</head>
<body>
  <h1>Time entries</h1>
  <p class="meta">Exported ${escapeHtml(now)} · ${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}</p>
  <table>
    <thead>
      <tr>
        <th>Started</th><th>Ended</th><th>Duration</th><th>Client</th><th>Notes</th><th>Source</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
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

export function TimeTrackingPage() {
  const { profile } = useAuth();
  const { customers, loading: customersLoading } = useCustomers();
  const { entries, loading: entriesLoading, error: entriesError, addEntry, removeEntry, reload } =
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
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const [logSortKey, setLogSortKey] = useState<TimeLogSortKey>('when');
  const [logSortDir, setLogSortDir] = useState<TimeLogSortDir>('desc');

  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) m.set(c.id, c.name);
    return m;
  }, [customers]);

  const sortedLogEntries = useMemo(
    () => sortWorkTimeEntries(entries, customerNameById, logSortKey, logSortDir),
    [entries, customerNameById, logSortKey, logSortDir],
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
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
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
              disabled={loading || entries.length === 0}
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
                    exportTimeEntriesToPdf(sortedLogEntries, customerNameById);
                    setExportOpen(false);
                  }}
                >
                  Export to PDF
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                  onClick={() => {
                    exportTimeEntriesToCsv(sortedLogEntries, customerNameById);
                    setExportOpen(false);
                  }}
                >
                  Export to CSV
                </button>
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
        <CardHeader title="Your log" subtitle="Click column headers to sort" />
        <CardBody className="p-0 sm:px-0">
          {loading ? (
            <div className="px-5 pb-5 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-text-muted">No entries yet. Use the timers or manual form above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
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
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {sortedLogEntries.map(row => (
                    <TimeRow
                      key={row.id}
                      row={row}
                      clientName={customerLabel(customerNameById, row.customerId)}
                      onDelete={() => void handleDelete(row.id)}
                      deleting={deleteId === row.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
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

function TimeRow({
  row,
  clientName,
  onDelete,
  deleting,
}: {
  row: WorkTimeEntry;
  clientName: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const durationMs = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
  const when = `${format(new Date(row.startedAt), 'PPp')} – ${format(new Date(row.endedAt), 'p')}`;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-primary-50/50 dark:hover:bg-primary-900/20">
      <td className="px-5 py-3 text-text-primary whitespace-nowrap">{when}</td>
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
      <td className="px-5 py-3 text-right">
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
      </td>
    </tr>
  );
}
