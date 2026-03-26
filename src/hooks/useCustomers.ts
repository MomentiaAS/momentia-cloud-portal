import { useState, useEffect, useCallback } from 'react';
import { fetchCustomers, insertCustomer, updateCustomer, deleteCustomer } from '../lib/db';
import type { Customer } from '../types';
import { supabase } from '../lib/supabase';

export interface CustomerFormPayload {
  name:               string;
  status:             string;
  tier:               string;
  domain:             string;
  orgNumber:          string;
  address:            string;
  state:              string;
  assignedTech:       string;
  notes:              string;
  contactName:        string;
  contactEmail:       string;
  contactPhone:       string;
  contactRole:        string;
  secContactName:     string;
  secContactEmail:    string;
  secContactPhone:    string;
  secContactRole:     string;
  veeam:              boolean;
  rmm:                boolean;
  m365:               boolean;
  azure:              boolean;
  sentinelOne:        boolean;
  unifi:              boolean;
  unifiSiteId:        string;
}

function payloadToDb(data: CustomerFormPayload) {
  const hasSecContact = data.secContactName.trim() || data.secContactEmail.trim();
  return {
    name:         data.name,
    status:       data.status,
    tier:         data.tier,
    domain:       data.domain       || undefined,
    orgNumber:    data.orgNumber    || undefined,
    address:      data.address      || undefined,
    state:        data.state        || undefined,
    assignedTech: data.assignedTech || undefined,
    notes:        data.notes        || undefined,
    primaryContact: {
      name:  data.contactName,
      email: data.contactEmail,
      phone: data.contactPhone || undefined,
      role:  data.contactRole  || undefined,
    },
    secondaryContact: hasSecContact ? {
      name:  data.secContactName  || undefined,
      email: data.secContactEmail || undefined,
      phone: data.secContactPhone || undefined,
      role:  data.secContactRole  || undefined,
    } : undefined,
    integrations: {
      veeam:       data.veeam,
      rmm:         data.rmm,
      m365:        data.m365,
      azure:       data.azure,
      sentinelOne: data.sentinelOne,
      unifi:       data.unifi,
    },
    unifiSiteId: data.unifiSiteId || undefined,
  };
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await fetchCustomers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the customers list "live" when Network tab updates `customers.health`
  // (e.g. during UniFi offline/health recalculation).
  useEffect(() => {
    const channel = supabase
      .channel('customers-health-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customers' },
        (payload) => {
          const row = payload.new as Partial<Customer> & { id?: string; health?: unknown };
          const id = row?.id;
          if (!id) return;

          // Only patch what we need for the Customers view.
          const health = row.health;
          if (health == null) return;

          setCustomers(prev => prev.map(c => (c.id === id ? { ...c, health: health as Customer['health'] } : c)));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Event-driven fallback for environments where Supabase realtime is blocked.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ customerId: string; health: Customer['health'] }>;
      const id = ce.detail?.customerId;
      const health = ce.detail?.health;
      if (!id || !health) return;

      setCustomers(prev =>
        prev.map(c => (c.id === id ? { ...c, health } : c)),
      );
    };

    window.addEventListener('customer-health-updated', handler);
    return () => window.removeEventListener('customer-health-updated', handler);
  }, []);

  async function addCustomer(data: CustomerFormPayload): Promise<void> {
    const created = await insertCustomer(payloadToDb(data));
    setCustomers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function editCustomer(id: string, data: CustomerFormPayload): Promise<void> {
    const updated = await updateCustomer(id, payloadToDb(data));
    setCustomers(prev => prev.map(c => c.id === id ? updated : c));
  }

  async function removeCustomer(id: string): Promise<void> {
    await deleteCustomer(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  }

  return { customers, loading, error, reload: load, addCustomer, editCustomer, removeCustomer };
}
