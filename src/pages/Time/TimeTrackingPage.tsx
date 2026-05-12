import { useMemo, useState, useCallback, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCustomers } from '../../hooks/useCustomers';
import { useWorkTimeEntries } from '../../hooks/useWorkTimeEntries';
import { useActiveWorkTimer } from '../../hooks/useActiveWorkTimer';
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

export function TimeTrackingPage() {
  const { profile } = useAuth();
  const { customers, loading: customersLoading } = useCustomers();
  const { entries, loading: entriesLoading, error: entriesError, addEntry, removeEntry, reload } =
    useWorkTimeEntries();
  const timer = useActiveWorkTimer();

  const [timerCustomer, setTimerCustomer] = useState<string>('');
  const [timerNotes, setTimerNotes] = useState('');
  const [timerActionError, setTimerActionError] = useState<string | null>(null);
  const [timerBusy, setTimerBusy] = useState(false);

  const [manualDate, setManualDate] = useState(() => localDateInputValue());
  const [manualStartTime, setManualStartTime] = useState('09:00');
  const [manualHours, setManualHours] = useState('1');
  const [manualMinutes, setManualMinutes] = useState('0');
  const [manualCustomer, setManualCustomer] = useState<string>('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) m.set(c.id, c.name);
    return m;
  }, [customers]);

  const handleStartTimer = useCallback(() => {
    setTimerActionError(null);
    const cid = timerCustomer === '' ? null : timerCustomer;
    if (!timer.start(cid, timerNotes)) {
      setTimerActionError('A timer is already running.');
    }
  }, [timer, timerCustomer, timerNotes]);

  const handleStopTimer = useCallback(async () => {
    if (!timer.active) return;
    const { customerId, startedAtIso, notes } = timer.active;
    const endedAtIso = new Date().toISOString();
    if (new Date(endedAtIso).getTime() <= new Date(startedAtIso).getTime()) {
      setTimerActionError('Invalid timer range.');
      return;
    }
    setTimerBusy(true);
    setTimerActionError(null);
    try {
      await addEntry({
        customerId,
        startedAt: startedAtIso,
        endedAt: endedAtIso,
        notes,
        source: 'timer',
      });
      timer.discard();
    } catch (e) {
      setTimerActionError(e instanceof Error ? e.message : 'Could not save entry.');
    } finally {
      setTimerBusy(false);
    }
  }, [timer, addEntry]);

  const handleManualSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setManualError(null);
      const h = Number.parseInt(manualHours, 10);
      const min = Number.parseInt(manualMinutes, 10);
      if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || min < 0 || min > 59) {
        setManualError('Enter a valid duration (hours ≥ 0, minutes 0–59).');
        return;
      }
      const durationMin = h * 60 + min;
      if (durationMin <= 0) {
        setManualError('Duration must be greater than zero.');
        return;
      }

      const localStart = new Date(`${manualDate}T${manualStartTime}:00`);
      if (Number.isNaN(localStart.getTime())) {
        setManualError('Invalid date or start time.');
        return;
      }
      const startedAt = localStart.toISOString();
      const endedAt = new Date(localStart.getTime() + durationMin * 60_000).toISOString();

      setManualBusy(true);
      try {
        await addEntry({
          customerId: manualCustomer === '' ? null : manualCustomer,
          startedAt,
          endedAt,
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
    [manualDate, manualStartTime, manualHours, manualMinutes, manualCustomer, manualNotes, addEntry],
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
            Track time per client with a timer or manual entries. Times use your computer&apos;s local timezone.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          Refresh list
        </Button>
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
          <CardHeader
            title="Timer"
            subtitle={timer.isRunning ? 'Running — stop to save to your log' : 'Start when you begin work'}
          />
          <CardBody className="space-y-4">
            {timer.isRunning ? (
              <>
                <div className="rounded-lg bg-primary-100/80 dark:bg-primary-900/30 px-4 py-6 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Elapsed</p>
                  <p className="text-3xl font-mono font-semibold text-text-primary tabular-nums mt-1">
                    {formatDurationMs(timer.elapsedMs)}
                  </p>
                  <p className="text-xs text-text-secondary mt-2">
                    {customerLabel(customerNameById, timer.active!.customerId)}
                    {timer.active!.notes ? ` · ${timer.active!.notes}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void handleStopTimer()} loading={timerBusy}>
                    Stop &amp; save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('Discard this timer without saving?')) timer.discard();
                    }}
                    disabled={timerBusy}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1" htmlFor="timer-customer">
                    Client
                  </label>
                  <select
                    id="timer-customer"
                    className={inputClass}
                    value={timerCustomer}
                    onChange={e => setTimerCustomer(e.target.value)}
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
                  value={timerNotes}
                  onChange={e => setTimerNotes(e.target.value)}
                />
                <Button variant="primary" onClick={handleStartTimer}>
                  Start timer
                </Button>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Manual entry" subtitle="Log time after the fact" />
          <CardBody>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {manualError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {manualError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Hours"
                  type="number"
                  min={0}
                  step={1}
                  value={manualHours}
                  onChange={e => setManualHours(e.target.value)}
                />
                <Input
                  label="Minutes"
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={manualMinutes}
                  onChange={e => setManualMinutes(e.target.value)}
                />
              </div>
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
              <Button type="submit" variant="secondary" loading={manualBusy}>
                Add entry
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Your log" subtitle="Newest first" />
        <CardBody className="p-0 sm:px-0">
          {loading ? (
            <div className="px-5 pb-5 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-text-muted">No entries yet. Use the timer or manual form above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <th className="px-5 py-3">When</th>
                    <th className="px-3 py-3">Duration</th>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map(row => (
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
