import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle, BookOpen, Eye, FileText, Pencil, Plus, Save, Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';
import { useCustomerDocumentation } from '../../hooks/useCustomerDocumentation';
import type { CustomerDocSection } from '../../types';

type EditorMode = 'edit' | 'preview';

function sectionPayload(s: CustomerDocSection, title: string, body: string) {
  return { title: title.trim() || 'Untitled', body, sortOrder: s.sortOrder };
}

export function DocumentationTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const {
    sections,
    loading,
    error,
    addSection,
    saveSection,
    removeSection,
    reload,
  } = useCustomerDocumentation(customerId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<EditorMode>(canEdit ? 'edit' : 'preview');
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const selected = sections.find(s => s.id === selectedId) ?? null;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // Pick first section when list loads or selection missing
  useEffect(() => {
    if (sections.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId(prev => {
      if (prev && sections.some(s => s.id === prev)) return prev;
      return sections[0].id;
    });
  }, [sections]);

  // Sync draft when switching section (ref avoids resetting draft when `sections` refetches)
  useEffect(() => {
    if (!selectedId) {
      setDraftTitle('');
      setDraftBody('');
      setDirty(false);
      return;
    }
    const s = sectionsRef.current.find(x => x.id === selectedId);
    if (!s) return;
    setDraftTitle(s.title);
    setDraftBody(s.body);
    setDirty(false);
  }, [selectedId]);

  useEffect(() => {
    if (!canEdit) setMode('preview');
  }, [canEdit]);

  const trySelect = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      if (dirty) {
        if (!window.confirm('You have unsaved changes. Discard them?')) return;
      }
      setSelectedId(id);
    },
    [dirty, selectedId],
  );

  async function handleSave() {
    if (!selected) return;
    setSaveBusy(true);
    try {
      await saveSection(selected.id, sectionPayload(selected, draftTitle, draftBody));
      setDirty(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleAdd() {
    if (dirty && !window.confirm('You have unsaved changes. Discard them and add a section?')) return;
    setAddBusy(true);
    try {
      const created = await addSection();
      setSelectedId(created.id);
      setDraftTitle(created.title);
      setDraftBody(created.body);
      setDirty(false);
      if (canEdit) setMode('edit');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not add section');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    setDeleteBusy(true);
    try {
      await removeSection(selected.id);
      setDirty(false);
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] animate-pulse">
        <div className="w-52 border-r border-border p-3 space-y-2 shrink-0">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="size-4 shrink-0" />
        {error}
      </div>
    );
  }

  const showEditor = canEdit && mode === 'edit';

  return (
    <div className="flex min-h-[320px] max-h-[min(70vh,720px)] border-t border-border">
      {/* Left nav */}
      <aside className="w-52 md:w-56 shrink-0 border-r border-border flex flex-col bg-surface/50">
        <div className="p-2 border-b border-border flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Sections</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addBusy}
              className="p-1.5 rounded-lg text-accent hover:bg-accent/10 disabled:opacity-50"
              title="Add section"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {sections.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-3 text-center">No sections yet.</p>
          ) : (
            sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => trySelect(s.id)}
                className={cn(
                  'w-full flex items-center gap-2 text-left text-sm px-2.5 py-2 rounded-lg transition-colors',
                  s.id === selectedId
                    ? 'bg-accent/15 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-hover',
                )}
              >
                <FileText className="size-3.5 shrink-0 text-text-muted" />
                <span className="truncate">{s.title}</span>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Editor / preview */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-text-muted">
            <BookOpen className="size-10 opacity-40" />
            <p className="text-sm">Add a section to start documenting this customer.</p>
            {canEdit && (
              <Button size="sm" variant="primary" onClick={() => void handleAdd()} disabled={addBusy}>
                <Plus className="size-3.5 mr-1" /> Add section
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border gap-y-2">
              {canEdit ? (
                <input
                  type="text"
                  value={draftTitle}
                  onChange={e => { setDraftTitle(e.target.value); setDirty(true); }}
                  className="flex-1 min-w-[120px] text-sm font-semibold text-text-primary bg-transparent border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="Section title"
                  disabled={!showEditor}
                  readOnly={!showEditor}
                />
              ) : (
                <h3 className="flex-1 min-w-0 text-sm font-semibold text-text-primary truncate">
                  {selected.title}
                </h3>
              )}

              {canEdit && (
                <div className="flex items-center gap-1 ml-auto">
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setMode('edit')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 text-xs font-medium',
                        mode === 'edit' ? 'bg-accent text-white' : 'text-text-muted hover:bg-surface-hover',
                      )}
                    >
                      <Pencil className="size-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('preview')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 text-xs font-medium border-l border-border',
                        mode === 'preview' ? 'bg-accent text-white' : 'text-text-muted hover:bg-surface-hover',
                      )}
                    >
                      <Eye className="size-3" /> Preview
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void handleSave()}
                    disabled={!dirty || !showEditor || saveBusy}
                  >
                    <Save className="size-3.5 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete()}
                    disabled={deleteBusy}
                    className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900"
                  >
                    <Trash2 className="size-3.5 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </div>

            <p className="shrink-0 px-3 py-1 text-[10px] text-text-muted">
              Updated {formatDistanceToNow(new Date(selected.updatedAt), { addSuffix: true })}
              {dirty && canEdit ? ' · Unsaved changes' : null}
            </p>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {showEditor ? (
                <textarea
                  value={draftBody}
                  onChange={e => { setDraftBody(e.target.value); setDirty(true); }}
                  className="w-full min-h-[240px] h-full max-h-[480px] text-sm font-mono text-text-primary bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
                  placeholder="Technical notes, procedures, IPs, credentials pointers (store secrets in a vault)…"
                  spellCheck
                />
              ) : (
                <div
                  className="text-sm text-text-secondary whitespace-pre-wrap font-mono bg-surface border border-border rounded-lg px-3 py-2 min-h-[240px]"
                >
                  {draftBody.trim() ? draftBody : (
                    <span className="text-text-muted italic">No content yet.</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
