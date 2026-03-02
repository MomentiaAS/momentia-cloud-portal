import { useState, useEffect, useCallback } from 'react';
import {
  fetchCustomerById,
  fetchAlertsByCustomer,
  fetchLogsByCustomer,
  fetchBackupJobsByCustomer,
  fetchAssignedUsersByCustomer,
} from '../lib/db';
import type { Customer, Alert, LogEntry, BackupJob } from '../types';
import type { Profile } from '../context/AuthContext';

interface CustomerDetail {
  customer:      Customer;
  alerts:        Alert[];
  logs:          LogEntry[];
  backupJobs:    BackupJob[];
  assignedUsers: Profile[];
}

export function useCustomerDetail(customerId: string | undefined) {
  const [detail,  setDetail]  = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch customer first — if this fails the page can't render at all.
      const customer = await fetchCustomerById(customerId);

      // Secondary queries are best-effort: a missing table (e.g. user_customers
      // not yet migrated) should not prevent the page from loading.
      const [alertsRes, logsRes, jobsRes, usersRes] = await Promise.allSettled([
        fetchAlertsByCustomer(customerId),
        fetchLogsByCustomer(customerId),
        fetchBackupJobsByCustomer(customerId),
        fetchAssignedUsersByCustomer(customerId),
      ]);

      setDetail({
        customer,
        alerts:        alertsRes.status === 'fulfilled' ? alertsRes.value : [],
        logs:          logsRes.status   === 'fulfilled' ? logsRes.value   : [],
        backupJobs:    jobsRes.status   === 'fulfilled' ? jobsRes.value   : [],
        assignedUsers: usersRes.status  === 'fulfilled' ? usersRes.value  : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  return { detail, loading, error, reload: load };
}
