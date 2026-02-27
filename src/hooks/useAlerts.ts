import { useState, useEffect, useCallback } from 'react';
import { fetchAlerts, resolveAlert } from '../lib/db';
import type { Alert } from '../types';

export function useAlerts(resolvedFilter?: boolean) {
  const [alerts,  setAlerts]  = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchAlerts(resolvedFilter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter]);

  useEffect(() => { load(); }, [load]);

  async function markResolved(id: string): Promise<void> {
    await resolveAlert(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
  }

  return { alerts, loading, error, reload: load, markResolved };
}
