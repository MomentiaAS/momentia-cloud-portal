import { useState, useEffect, useCallback } from 'react';
import { fetchLogs } from '../lib/db';
import type { LogEntry } from '../types';

export function useLogs() {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await fetchLogs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { logs, loading, error, reload: load };
}
