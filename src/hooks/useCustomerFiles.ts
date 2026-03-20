import { useState, useEffect, useCallback } from 'react';
import {
  fetchCustomerFiles,
  insertCustomerFolder,
  uploadCustomerLibraryFile,
  deleteCustomerFileNode,
  getCustomerFileSignedUrl,
} from '../lib/db';
import type { CustomerFileNode } from '../types';

export function useCustomerFiles(customerId: string) {
  const [nodes, setNodes] = useState<CustomerFileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNodes(await fetchCustomerFiles(customerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function createFolder(parentId: string | null, name: string): Promise<void> {
    const row = await insertCustomerFolder(customerId, parentId, name);
    setNodes(prev => [...prev, row].sort(sortNodes));
  }

  async function uploadFile(parentId: string | null, file: File): Promise<void> {
    const row = await uploadCustomerLibraryFile(customerId, parentId, file);
    setNodes(prev => [...prev, row].sort(sortNodes));
  }

  async function removeNode(id: string): Promise<void> {
    await deleteCustomerFileNode(customerId, id);
    setNodes(prev => prev.filter(n => !isOrDescendantOf(prev, id, n.id)));
  }

  return {
    nodes,
    loading,
    error,
    reload: load,
    createFolder,
    uploadFile,
    removeNode,
    getDownloadUrl: getCustomerFileSignedUrl,
  };
}

function sortNodes(a: CustomerFileNode, b: CustomerFileNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** True if nodeId is the ancestor row or any of its descendants (for pruning local state after delete). */
function isOrDescendantOf(all: CustomerFileNode[], ancestorId: string, nodeId: string): boolean {
  let id: string | null = nodeId;
  while (id) {
    if (id === ancestorId) return true;
    const row = all.find(n => n.id === id);
    id = row?.parentId ?? null;
  }
  return false;
}
