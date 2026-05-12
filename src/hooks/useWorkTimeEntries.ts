import { useCallback, useEffect, useState } from 'react';
import type { WorkTimeEntry, WorkTimeSource } from '../types';
import {
  deleteWorkTimeEntry,
  fetchWorkTimeEntriesForUser,
  insertWorkTimeEntry,
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

  return { entries, loading, error, reload: load, addEntry, removeEntry };
}
