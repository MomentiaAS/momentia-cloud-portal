import { useCallback, useEffect, useState } from 'react';
import type { WorkTimeEntry, WorkTimeSource } from '../types';
import {
  deleteWorkTimeEntry,
  fetchWorkTimeEntriesForUser,
  insertWorkTimeEntry,
  updateWorkTimeEntry,
} from '../lib/db';

export function useWorkTimeEntries() {
  const [entries, setEntries] = useState<WorkTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchWorkTimeEntriesForUser();
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addEntry = useCallback(
    async (payload: {
      customerId: string | null;
      startedAt: string;
      endedAt: string;
      notes: string;
      source: WorkTimeSource;
    }) => {
      const row = await insertWorkTimeEntry(payload);
      setEntries(prev =>
        [...prev, row].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        ),
      );
      return row;
    },
    [],
  );

  const removeEntry = useCallback(async (id: string) => {
    await deleteWorkTimeEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const setEntryInvoiced = useCallback(async (id: string, invoiced: boolean) => {
    const invoicedAt = invoiced ? new Date().toISOString() : null;
    let prevRow: WorkTimeEntry | undefined;
    setEntries(prev => {
      prevRow = prev.find(e => e.id === id);
      return prev.map(e => (e.id === id ? { ...e, invoicedAt } : e));
    });
    try {
      const updated = await updateWorkTimeEntry(id, { invoicedAt });
      setEntries(prev => prev.map(e => (e.id === id ? updated : e)));
    } catch {
      const revert = prevRow;
      if (revert) {
        setEntries(prev => prev.map(e => (e.id === id ? revert : e)));
      } else {
        void load();
      }
      throw new Error('Could not update invoiced status.');
    }
  }, [load]);

  return { entries, loading, error, reload: load, addEntry, removeEntry, setEntryInvoiced };
}
