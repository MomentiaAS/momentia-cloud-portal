import { useState, useEffect, useCallback } from 'react';
import { fetchBackupJobs } from '../lib/db';
import type { BackupJob } from '../types';

export function useBackupJobs() {
  const [jobs,    setJobs]    = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await fetchBackupJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load backup jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { jobs, loading, error, reload: load };
}
