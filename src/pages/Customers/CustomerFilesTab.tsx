import { useMemo, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  ChevronRight,
  Download,
  FolderPlus,
  Folder,
  Home,
  Trash2,
  Upload,
  File,
  RefreshCw,
} from 'lucide-react';
import { useCustomerFiles } from '../../hooks/useCustomerFiles';
import { cn } from '../../components/ui/cn';
import { Button } from '../../components/ui/Button';
import type { CustomerFileNode } from '../../types';

function formatBytes(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function buildBreadcrumb(
  nodes: CustomerFileNode[],
  currentFolderId: string | null,
): { id: string | null; name: string }[] {
  const chain: { id: string | null; name: string }[] = [{ id: null, name: 'Root' }];
  if (!currentFolderId) return chain;

  const byId = new Map(nodes.map(n => [n.id, n]));
  const parts: { id: string | null; name: string }[] = [];
  let cur: string | null = currentFolderId;
  while (cur) {
    const row = byId.get(cur);
    if (!row) break;
    parts.push({ id: row.id, name: row.name });
    cur = row.parentId ?? null;
  }
  parts.reverse();
  return [{ id: null, name: 'Root' }, ...parts];
}

export function CustomerFilesTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const {
    nodes,
    loading,
    error,
    createFolder,
    uploadFile,
    removeNode,
    getDownloadUrl,
    reload,
  } = useCustomerFiles(customerId);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => nodes.filter(n => (n.parentId ?? null) === folderId),
    [nodes, folderId],
  );

  const selectedItems = useMemo(
    () => items.filter(i => selectedIds.includes(i.id)),
    [items, selectedIds],
  );

  const crumbs = useMemo(() => buildBreadcrumb(nodes, folderId), [nodes, folderId]);

  const openFolder = useCallback((id: string) => {
    setFolderId(id);
    setSelectedIds([]);
  }, []);

  const goCrumb = useCallback((id: string | null) => {
    setFolderId(id);
    setSelectedIds([]);
  }, []);

  async function handleNewFolder() {
    const name = window.prompt('Folder name');
    if (name == null || !name.trim()) return;
    try {
      await createFolder(folderId, name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not create folder');
    }
  }

  async function handleFilesChosen(files: FileList | null) {
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await uploadFile(folderId, file);
      } catch (e) {
        window.alert(`${file.name}: ${e instanceof Error ? e.message : 'Upload failed'}`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    setUploadOpen(false);
  }

  async function handleDownload(node: CustomerFileNode) {
    if (node.kind !== 'file' || !node.storagePath) return;
    try {
      const url = await getDownloadUrl(node.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Download failed');
    }
  }

  async function handleDelete(node: CustomerFileNode) {
    const label = node.kind === 'folder' ? `folder “${node.name}” and everything inside it` : `“${node.name}”`;
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await removeNode(node.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function toggleSelectAllCurrent() {
    const allIds = items.map(i => i.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : allIds);
  }

  async function handleBulkDownload() {
    const files = selectedItems.filter(i => i.kind === 'file' && i.storagePath);
    if (files.length === 0) {
      window.alert('Select at least one file to download.');
      return;
    }
    for (const f of files) {
      try {
        const url = await getDownloadUrl(f.storagePath!);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        window.alert(`${f.name}: ${e instanceof Error ? e.message : 'Download failed'}`);
      }
    }
  }

  async function handleBulkDelete() {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected item(s)?`)) return;
    for (const item of selectedItems) {
      try {
        await removeNode(item.id);
      } catch (e) {
        window.alert(`${item.name}: ${e instanceof Error ? e.message : 'Delete failed'}`);
      }
    }
    setSelectedIds([]);
  }

  if (loading) {
    return (
      <div className="p-4 space-y-2 animate-pulse">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
        <p className="text-xs text-text-muted">
          Run the v10 migration in Supabase (table <code className="font-mono">customer_files</code> + bucket{' '}
          <code className="font-mono">customer-files</code>).
        </p>
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          <RefreshCw className="size-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[280px]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border gap-y-2">
        <nav className="flex flex-wrap items-center gap-0.5 text-xs text-text-muted min-w-0">
          {crumbs.map((c, i) => {
            const isHere = i === crumbs.length - 1;
            return (
              <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-0.5 min-w-0">
                {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-50" />}
                <button
                  type="button"
                  onClick={() => goCrumb(c.id)}
                  className={cn(
                    'truncate max-w-[140px] hover:text-text-primary transition-colors flex items-center gap-1',
                    isHere ? 'text-accent font-medium' : '',
                  )}
                >
                  {c.id === null ? <Home className="size-3 shrink-0" /> : null}
                  {c.name}
                </button>
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => void reload()}
            className="p-1.5 rounded-lg text-text-muted hover:bg-surface-overlay"
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => void handleNewFolder()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent/10"
              >
                <FolderPlus className="size-3.5" /> New folder
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent/10"
              >
                <Upload className="size-3.5" /> Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => void handleFilesChosen(e.target.files)}
              />
            </>
          )}
        </div>
      </div>

      {canEdit && selectedIds.length > 0 && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <span className="text-xs text-text-muted">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => void handleBulkDownload()}>
            <Download className="size-3.5 mr-1" /> Download selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleBulkDelete()} className="text-red-500 border-red-200 dark:border-red-900">
            <Trash2 className="size-3.5 mr-1" /> Delete selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {canEdit && uploadOpen && (
        <div className="px-3 py-3 border-b border-border">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              // Only deactivate when leaving the dropzone element itself.
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleFilesChosen(e.dataTransfer.files);
            }}
            className={cn(
              'w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              dragActive
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:bg-surface/80',
            )}
          >
            <p className="text-sm font-medium text-text-primary">Drag and drop files here</p>
            <p className="text-xs text-text-muted mt-1">or click to choose files</p>
          </button>
        </div>
      )}

      <div className="divide-y divide-border flex-1 overflow-y-auto max-h-[min(60vh,560px)]">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center px-4">This folder is empty.</p>
        ) : (
          items.map(node => (
            <div
              key={node.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface/80"
            >
              {canEdit && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(node.id)}
                  onChange={() => toggleSelected(node.id)}
                  className="accent-accent size-3.5 shrink-0"
                  aria-label={`Select ${node.name}`}
                />
              )}
              {node.kind === 'folder' ? (
                <button
                  type="button"
                  onClick={() => openFolder(node.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  <Folder className="size-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-text-primary truncate">{node.name}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <File className="size-4 text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary truncate">{node.name}</span>
                  <span className="text-xs text-text-muted shrink-0 hidden sm:inline">{formatBytes(node.sizeBytes)}</span>
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {node.kind === 'file' && (
                  <button
                    type="button"
                    onClick={() => void handleDownload(node)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10"
                    title="Download"
                  >
                    <Download className="size-4" />
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(node)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {canEdit && items.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <button
            type="button"
            onClick={toggleSelectAllCurrent}
            className="text-accent hover:underline"
          >
            {items.every(i => selectedIds.includes(i.id)) ? 'Unselect all' : 'Select all'}
          </button>
          <span>{items.length} item(s)</span>
        </div>
      )}
    </div>
  );
}
