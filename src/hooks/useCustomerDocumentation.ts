import { useState, useEffect, useCallback } from 'react';
import {
  fetchDocSectionsByCustomer,
  insertDocSection,
  updateDocSection,
  deleteDocSection,
  type DocSectionPayload,
} from '../lib/db';
import type { CustomerDocSection } from '../types';

export type { DocSectionPayload };

export function useCustomerDocumentation(customerId: string) {
  const [sections, setSections] = useState<CustomerDocSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSections(await fetchDocSectionsByCustomer(customerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function addSection(): Promise<CustomerDocSection> {
    const nextOrder =
      sections.length === 0 ? 0 : Math.max(...sections.map(s => s.sortOrder)) + 1;
    const created = await insertDocSection(customerId, {
      title: 'New section',
      body: '',
      sortOrder: nextOrder,
    });
    await load();
    return created;
  }

  async function saveSection(id: string, p: DocSectionPayload): Promise<void> {
    const updated = await updateDocSection(id, p);
    setSections(prev => prev.map(s => (s.id === id ? updated : s)).sort(compareSections));
  }

  async function removeSection(id: string): Promise<void> {
    await deleteDocSection(id);
    setSections(prev => prev.filter(s => s.id !== id));
  }

  return {
    sections,
    loading,
    error,
    reload: load,
    addSection,
    saveSection,
    removeSection,
  };
}

function compareSections(a: CustomerDocSection, b: CustomerDocSection): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}
