import { useState, useEffect, useCallback } from 'react';
import { fetchCustomers, insertCustomer, updateCustomer, deleteCustomer } from '../lib/db';
import type { Customer } from '../types';

export interface CustomerFormPayload {
  name:               string;
  status:             string;
  tier:               string;
  domain:             string;
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
