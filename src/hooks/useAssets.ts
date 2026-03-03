import { useState, useEffect, useCallback } from 'react';
import {
  fetchAssetsByCustomer, fetchAllAssets,
  insertAsset, updateAsset, deleteAsset,
  type AssetPayload,
} from '../lib/db';
import type { Asset } from '../types';

export type { AssetPayload };

/** Hook for a single customer's assets (used in the customer detail tab). */
export function useCustomerAssets(customerId: string) {
  const [assets,  setAssets]  = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await fetchAssetsByCustomer(customerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function addAsset(p: AssetPayload): Promise<void> {
    const created = await insertAsset(customerId, p);
    setAssets(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function editAsset(id: string, p: AssetPayload): Promise<void> {
    const updated = await updateAsset(id, p);
    setAssets(prev => prev.map(a => a.id === id ? updated : a));
  }

  async function removeAsset(id: string): Promise<void> {
    await deleteAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  }

  return { assets, loading, error, reload: load, addAsset, editAsset, removeAsset };
}

/** Hook for all assets across all customers (used on the global Assets page). */
export function useAllAssets() {
  const [assets,  setAssets]  = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await fetchAllAssets());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { assets, loading, error, reload: load };
}
