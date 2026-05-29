import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertCircle, BookOpen, Eye, FileText, Pencil, Plus, Save, Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';
import { useCustomerDocumentation } from '../../hooks/useCustomerDocumentation';
import type { CustomerDocSection } from '../../types';
import { DocRichTextEditor } from '../../components/editor/DocRichTextEditor';
import '../../components/editor/doc-editor.css';
import {
  normalizeBodyForEditor,
  sanitizeCustomerDocHtml,
  canonicalDocHtmlForCompare,
  normalizeDocTitle,
} from '../../lib/docHtml';

type EditorMode = 'edit' | 'preview';

function sectionPayload(s: CustomerDocSection, title: string, body: string) {
  return { title: title.trim() || 'Untitled', body, sortOrder: s.sortOrder };
}

function DocHtmlPreview({ html }: { html: string }) {
  const safe = useMemo(() => sanitizeCustomerDocHtml(html || ''), [html]);
  const isEmpty = !html?.replace(/<[^>]+>/g, '').trim();
  if (isEmpty) {
    return <p className="text-text-muted italic text-sm px-3 py-2 min-h-[240px]">No content yet.</p>;
  }
  return (
    <div
      className="doc-html-preview"
      // sanitized in useMemo
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

export function DocumentationTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const {
    sections,
    loading,
    error,
    addSection,
    saveSection,
    removeSection,
    reorderSections,
    reload,
  } = useCustomerDocumentation(customerId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  /** Last persisted snapshot for the current section — dirty = draft differs (canonical compare for HTML). */
  const [baseline, setBaseline] = useState<{ title: string; body: string } | null>(null);
  const [mode, setMode] = useState<EditorMode>(canEdit ? 'edit' : 'preview');
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusTitleRef = useRef(false);

  const selected = sections.find(s => s.id === selectedId) ?? null;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  /** Keep draft/baseline in lockstep with selection in one commit so TipTap (keyed by id) never mounts with the previous section's HTML. */
  const applySection = useCallback((id: string | null, row?: { title: string; body: string }) => {
    if (id == null) {
      flushSync(() => {
        setSelectedId(null);
        setDraftTitle('');
        setDraftBody('');
        setBaseline(null);
      });
      return;
    }
    const s = row ?? sectionsRef.current.find(x => x.id === id);
    if (!s) return;
    const body = s.body ?? '';
    flushSync(() => {
      setSelectedId(id);
      setDraftTitle(s.title);
      setDraftBody(body);
      setBaseline({ title: s.title, body });
    });
  }, []);

  // When the section list changes: resolve selection + sync draft in the same commit (avoid stale body on new mount).
  useEffect(() => {
    if (sections.length === 0) {
      applySection(null);
      return;
    }
    const prev = selectedIdRef.current;
    const resolved =
      prev !== null && sections.some(s => s.id === prev) ? prev : sections[0].id;
    if (resolved !== prev) {
      const row = sections.find(x => x.id === resolved);
      if (row) applySection(resolved, row);
    }
  }, [sections, applySection]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    const titleChanged = normalizeDocTitle(draftTitle) !== normalizeDocTitle(baseline.title);
    const bodyChanged =
      canonicalDocHtmlForCompare(draftBody) !== canonicalDocHtmlForCompare(baseline.body);
    return titleChanged || bodyChanged;
  }, [baseline, draftTitle, draftBody]);

  useEffect(() => {
    if (!canEdit) setMode('preview');
  }, [canEdit]);

  const trySelect = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      if (dirty) {
        if (!window.confirm('You have unsaved changes. Discard them?')) return;
      }
      applySection(id);
    },
    [dirty, selectedId, applySection],
  );

  async function handleSave() {
    if (!selected) return;
    setSaveBusy(true);
    try {
      await saveSection(selected.id, sectionPayload(selected, draftTitle, draftBody));
      setBaseline({
        title: normalizeDocTitle(draftTitle),
        body: draftBody,
      });
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
      shouldFocusTitleRef.current = true;
      applySection(created.id, {
        title: created.title,
        body: created.body ?? '',
      });
      if (canEdit) setMode('edit');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not add section');
    } finally {
      setAddBusy(false);
    }
  }

  useEffect(() => {
    if (!shouldFocusTitleRef.current) return;
    if (!selectedId) return;
    const el = titleInputRef.current;
    if (!el) return;
    shouldFocusTitleRef.current = false;
    el.focus();
    el.select();
  }, [selectedId]);

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    setDeleteBusy(true);
    try {
      await removeSection(selected.id);
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleDropOnSection(targetId: string) {
    if (!dragSectionId || dragSectionId === targetId || reorderBusy) return;
    const from = sections.findIndex(s => s.id === dragSectionId);
    const to = sections.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    setReorderBusy(true);
    try {
      await reorderSections(reordered.map(s => s.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not reorder sections');
    } finally {
      setDragSectionId(null);
      setReorderBusy(false);
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
    <div className="flex flex-col md:flex-row min-h-[320px] max-h-[min(85dvh,720px)] border-t border-border">
      {/* Section picker — dropdown on mobile, sidebar on md+ */}
      <div className="md:hidden shrink-0 p-3 border-b border-border bg-surface/50">
        <label className="sr-only" htmlFor="doc-section-select">Documentation section</label>
        <select
          id="doc-section-select"
          value={selectedId ?? ''}
          onChange={e => {
            const id = e.target.value;
            if (id) trySelect(id);
          }}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-text-primary"
        >
          {sections.length === 0 ? (
            <option value="">No sections</option>
          ) : (
            sections.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))
          )}
        </select>
      </div>
      <aside className="hidden md:flex w-52 lg:w-56 shrink-0 border-r border-border flex-col bg-surface/50">
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
                draggable={canEdit && !reorderBusy}
                onDragStart={() => setDragSectionId(s.id)}
                onDragEnd={() => setDragSectionId(null)}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  void handleDropOnSection(s.id);
                }}
                onClick={() => trySelect(s.id)}
                className={cn(
                  'w-full flex items-center gap-2 text-left text-sm px-2.5 py-2 rounded-lg transition-colors',
                  s.id === selectedId
                    ? 'bg-accent/15 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-hover',
                  canEdit && 'cursor-grab active:cursor-grabbing',
                  dragSectionId === s.id && 'opacity-60',
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
                  ref={titleInputRef}
                  type="text"
                  value={draftTitle}
                  onChange={e => { setDraftTitle(e.target.value); }}
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

            <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col">
              {showEditor ? (
                <DocRichTextEditor
                  key={selectedId}
                  value={normalizeBodyForEditor(draftBody)}
                  onChange={setDraftBody}
                  customerId={customerId}
                  sectionId={selected.id}
                  editable
                  placeholder="Technical notes, procedures, diagrams (images upload to secure storage)…"
                />
              ) : (
                <DocHtmlPreview html={draftBody} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
