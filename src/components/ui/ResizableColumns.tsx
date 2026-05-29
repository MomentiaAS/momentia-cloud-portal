import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './cn';

export type ColumnWidthMap = Record<string, number>;

export function useResizableColumns(args: {
  tableId: string;
  defaults: ColumnWidthMap;
  minWidth?: number;
  maxWidth?: number;
}) {
  const { tableId, defaults, minWidth = 80, maxWidth = 800 } = args;
  const storageKey = `momentia:table-widths:${tableId}`;

  const [widths, setWidths] = useState<ColumnWidthMap>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as ColumnWidthMap) : {};
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // ignore quota / storage errors
    }
  }, [storageKey, widths]);

  function setWidth(key: string, next: number) {
    const clamped = Math.max(minWidth, Math.min(maxWidth, Math.round(next)));
    setWidths(prev => (prev[key] === clamped ? prev : { ...prev, [key]: clamped }));
  }

  function reset() {
    setWidths({ ...defaults });
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  return { widths, setWidth, reset };
}

export function ResizableColGroup({
  columns,
  widths,
}: {
  columns: Array<{ key: string; hidden?: boolean }>;
  widths: ColumnWidthMap;
}) {
  return (
    <colgroup>
      {columns.map(c => (
        <col
          key={c.key}
          style={{ width: widths[c.key] ? `${widths[c.key]}px` : undefined }}
          className={c.hidden ? 'hidden' : undefined}
        />
      ))}
    </colgroup>
  );
}

export function ResizableTh({
  colKey,
  widths,
  onResize,
  className,
  children,
  resizable = true,
}: {
  colKey: string;
  widths: ColumnWidthMap;
  onResize: (key: string, nextWidth: number) => void;
  className?: string;
  children: React.ReactNode;
  /** False on touch / narrow viewports (no drag handle). */
  resizable?: boolean;
}) {
  const startXRef = useRef(0);
  const startWRef = useRef(0);
  const draggingRef = useRef(false);

  const w = widths[colKey];

  const onMouseDown = (e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = w || (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect().width || 160;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = ev.clientX - startXRef.current;
      onResize(colKey, startWRef.current + dx);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const widthStyle = useMemo(() => (
    w ? ({ width: `${w}px` } as const) : undefined
  ), [w]);

  return (
    <th
      className={cn('px-4 py-2.5 relative select-none', className)}
      style={widthStyle}
    >
      {children}
      {resizable && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDown}
          className={cn(
            'absolute top-0 right-0 h-full w-2 cursor-col-resize hidden lg:block',
            'hover:bg-accent/15',
          )}
          title="Drag to resize"
        />
      )}
    </th>
  );
}

