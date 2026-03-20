import './doc-editor.css';
import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { normalizeBodyForEditor } from '../../lib/docHtml';
import { uploadCustomerDocImage } from '../../lib/docMedia';
import { cn } from '../ui/cn';

export interface DocRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  customerId: string;
  sectionId: string;
  editable: boolean;
  placeholder?: string;
}

async function insertImageFromFile(
  editor: Editor | null,
  customerId: string,
  sectionId: string,
  file: File,
) {
  if (!editor) return;
  try {
    const url = await uploadCustomerDocImage(customerId, sectionId, file);
    editor.chain().focus().setImage({ src: url }).run();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Image upload failed');
  }
}

/**
 * When clipboard has both HTML (e.g. OneNote/Word table) and a PNG screenshot, we must
 * prefer HTML so the table stays editable — otherwise our image handler wins and pastes a picture.
 */
function shouldLetEditorParseHtmlPaste(html: string, plain: string): boolean {
  const t = html?.trim() ?? '';
  if (t.length === 0) return false;

  const h = t.toLowerCase();

  if (
    /<table[\s>]/.test(h) ||
    /<thead[\s>]/.test(h) ||
    /<tbody[\s>]/.test(h) ||
    /<tr[\s>]/.test(h) ||
    /<td[\s>]/.test(h) ||
    /<th[\s>]/.test(h)
  ) {
    return true;
  }
  if (/<ul[\s>]/.test(h) || /<ol[\s>]/.test(h)) {
    return true;
  }

  // OneNote / Word often put real structure here plus a duplicate bitmap on the clipboard.
  if (
    h.includes('xmlns:m') ||
    h.includes('xmlns:o') ||
    h.includes('urn:schemas-microsoft-com') ||
    h.includes('office:word') ||
    h.includes('microsoft-com:office') ||
    h.includes('onenote')
  ) {
    if (isClipboardHtmlOnlySingleImage(t)) return false;
    return true;
  }

  // Excel and similar: TSV/plain grid + HTML wrapper
  const p = plain ?? '';
  if (p.includes('\t') && p.split(/\n/).filter(line => line.trim()).length >= 2 && t.length > 40) {
    return true;
  }

  return false;
}

/** True when CF_HTML is essentially one raster image (no table to edit — use file upload path). */
function isClipboardHtmlOnlySingleImage(html: string): boolean {
  const h = html.toLowerCase();
  if (/<table[\s>]|<tr[\s>]|<td[\s>]|<th[\s>]/.test(h)) return false;
  const imgs = html.match(/<img\b/gi);
  return imgs !== null && imgs.length === 1;
}

export function DocRichTextEditor({
  value,
  onChange,
  customerId,
  sectionId,
  editable,
  placeholder = 'Technical notes, procedures, diagrams…',
}: DocRichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const idsRef = useRef({ customerId, sectionId });
  idsRef.current = { customerId, sectionId };

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            class: 'text-accent underline',
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
        Image.configure({ inline: false, allowBase64: false }),
        Table.configure({
          resizable: false,
          HTMLAttributes: { class: 'doc-table' },
        }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder }),
      ],
      content: normalizeBodyForEditor(value),
      editable,
      editorProps: {
        attributes: {
          class: 'prose-doc',
        },
        handlePaste(_view, event) {
          const cd = event.clipboardData;
          if (!cd) return false;

          const html = cd.getData('text/html');
          const plain = cd.getData('text/plain');
          if (shouldLetEditorParseHtmlPaste(html, plain)) {
            return false;
          }

          const items = cd.items;
          if (!items) return false;
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              const { customerId: cid, sectionId: sid } = idsRef.current;
              if (file) void insertImageFromFile(editorRef.current, cid, sid, file);
              return true;
            }
          }
          return false;
        },
        handleDrop(_view, event, _slice, moved) {
          if (moved) return false;
          const file = event.dataTransfer?.files?.[0];
          if (file?.type.startsWith('image/')) {
            event.preventDefault();
            const { customerId: cid, sectionId: sid } = idsRef.current;
            void insertImageFromFile(editorRef.current, cid, sid, file);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
    },
  );

  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  const run = useCallback(
    (fn: (ed: Editor) => boolean) => {
      if (!editor || editor.isDestroyed) return;
      fn(editor);
    },
    [editor],
  );

  const addLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (https://…)', prev ?? 'https://');
    if (url === null) return;
    const t = url.trim();
    if (t === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run();
  }, [editor]);

  const onPickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!editor) {
    return <div className="doc-editor-root min-h-[240px] animate-pulse rounded-lg bg-surface border border-border" />;
  }

  return (
    <div className="doc-editor-root flex flex-col min-h-0">
      {editable ? (
        <div className="doc-editor-toolbar">
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleBold().run())}
            className={cn(editor.isActive('bold') && 'is-active')}
            title="Bold"
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleItalic().run())}
            className={cn(editor.isActive('italic') && 'is-active')}
            title="Italic"
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleUnderline().run())}
            className={cn(editor.isActive('underline') && 'is-active')}
            title="Underline"
          >
            <UnderlineIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleStrike().run())}
            className={cn(editor.isActive('strike') && 'is-active')}
            title="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleCode().run())}
            className={cn(editor.isActive('code') && 'is-active')}
            title="Inline code"
          >
            <Code className="size-4" />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleHeading({ level: 2 }).run())}
            className={cn(editor.isActive('heading', { level: 2 }) && 'is-active')}
            title="Heading 2"
          >
            <Heading2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleHeading({ level: 3 }).run())}
            className={cn(editor.isActive('heading', { level: 3 }) && 'is-active')}
            title="Heading 3"
          >
            <Heading3 className="size-4" />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleBulletList().run())}
            className={cn(editor.isActive('bulletList') && 'is-active')}
            title="Bullet list"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleOrderedList().run())}
            className={cn(editor.isActive('orderedList') && 'is-active')}
            title="Numbered list"
          >
            <ListOrdered className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().toggleBlockquote().run())}
            className={cn(editor.isActive('blockquote') && 'is-active')}
            title="Quote"
          >
            <Quote className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().setHorizontalRule().run())}
            title="Horizontal rule"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
          <button
            type="button"
            onClick={() =>
              run(ed =>
                ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
              )
            }
            title="Insert table (3×3)"
          >
            <Table2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().deleteTable().run())}
            disabled={!editor.can().deleteTable()}
            title="Delete table"
          >
            <Trash2 className="size-4" />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
          <button type="button" onClick={addLink} className={cn(editor.isActive('link') && 'is-active')} title="Link">
            <Link2 className="size-4" />
          </button>
          <button type="button" onClick={onPickImage} title="Insert image">
            <ImageIcon className="size-4" />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().undo().run())}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => run(ed => ed.chain().focus().redo().run())}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 className="size-4" />
          </button>
        </div>
      ) : null}

      <EditorContent editor={editor} className="doc-editor-content" />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void insertImageFromFile(editor, customerId, sectionId, f);
        }}
      />
    </div>
  );
}
