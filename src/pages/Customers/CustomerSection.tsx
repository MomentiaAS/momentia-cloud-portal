import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { ResizableColGroup, ResizableTh, useResizableColumns } from '../../components/ui/ResizableColumns';
import { CustomerRow } from './CustomerRow';
import type { Customer } from '../../types';

export type CustomerSortKey = 'name' | 'health' | 'alerts' | 'tier' | 'lastSync' | 'assignedTech';
export type CustomerSortDir = 'asc' | 'desc';

interface CustomerSectionProps {
  title:         string;
  customers:     Customer[];
  onEdit:        (c: Customer) => void;
  onView:        (c: Customer) => void;
  defaultOpen?:  boolean;
  collapsible?:  boolean;
  archived?:     boolean;
  sortKey?:      CustomerSortKey;
  sortDir?:      CustomerSortDir;
  onSort?:       (k: CustomerSortKey) => void;
}

const TABLE_HEADERS: Array<{ label: string; key?: CustomerSortKey; className: string }> = [
  { label: 'Customer',      key: 'name',        className: '' },
  { label: 'Health',        key: 'health',      className: 'hidden sm:table-cell' },
  { label: 'Alerts',        key: 'alerts',      className: 'hidden md:table-cell' },
  { label: 'Tier',          key: 'tier',        className: 'hidden lg:table-cell' },
  { label: 'Last Sync',     key: 'lastSync',    className: 'hidden lg:table-cell' },
  { label: 'Assigned Tech', key: 'assignedTech',className: 'hidden xl:table-cell' },
  { label: '',              className: '' },
];

export function CustomerSection({
  title,
  customers,
  onEdit,
  onView,
  defaultOpen = true,
  collapsible,
  archived,
  sortKey,
  sortDir,
  onSort,
}: CustomerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { widths, setWidth } = useResizableColumns({
    tableId: `customers:${title.toLowerCase()}`,
    defaults: {
      name: 260,
      health: 140,
      alerts: 120,
      tier: 120,
      lastSync: 160,
      assignedTech: 180,
      actions: 120,
    },
    minWidth: 90,
    maxWidth: 520,
  });

  const cols = [
    { key: 'name' },
    { key: 'health', hidden: TABLE_HEADERS[1].className.includes('hidden') },
    { key: 'alerts', hidden: TABLE_HEADERS[2].className.includes('hidden') },
    { key: 'tier', hidden: TABLE_HEADERS[3].className.includes('hidden') },
    { key: 'lastSync', hidden: TABLE_HEADERS[4].className.includes('hidden') },
    { key: 'assignedTech', hidden: TABLE_HEADERS[5].className.includes('hidden') },
    { key: 'actions' },
  ] as const;

  return (
    <section className="mb-6">
      <button
        className={cn(
          'flex items-center gap-2 w-full text-left mb-2 focus-ring rounded-md',
          collapsible ? 'cursor-pointer' : 'cursor-default pointer-events-none',
        )}
        onClick={() => collapsible && setOpen(v => !v)}
        aria-expanded={open}
      >
        {collapsible
          ? (open ? <ChevronDown className="size-4 text-text-muted" /> : <ChevronRight className="size-4 text-text-muted" />)
          : <span className="size-4" />
        }
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h2>
        <span className="ml-auto text-xs text-text-muted">{customers.length}</span>
      </button>

      {open && (
        <div className="bg-surface-raised border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <ResizableColGroup columns={cols as unknown as Array<{ key: string; hidden?: boolean }>} widths={widths} />
              <thead>
                <tr className="border-b border-border">
                  {TABLE_HEADERS.map((h, i) => (
                    <ResizableTh
                      key={i}
                      colKey={h.key ?? (i === TABLE_HEADERS.length - 1 ? 'actions' : `col-${i}`)}
                      widths={widths}
                      onResize={setWidth}
                      className={cn(
                        'text-left text-xs font-semibold text-text-muted uppercase tracking-wider',
                        h.className,
                      )}
                    >
                      {h.key && onSort ? (
                        <button
                          type="button"
                          onClick={() => onSort(h.key!)}
                          className={cn(
                            'inline-flex items-center gap-1.5 transition-colors',
                            sortKey === h.key ? 'text-accent' : 'text-text-muted hover:text-text-primary',
                          )}
                        >
                          {h.label}
                          {sortKey === h.key
                            ? (sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)
                            : <ChevronsUpDown className="size-3" />
                          }
                        </button>
                      ) : (
                        h.label
                      )}
                    </ResizableTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-text-muted">
                      No customers in this group.
                    </td>
                  </tr>
                ) : (
                  customers.map(c => (
                    <CustomerRow
                      key={c.id}
                      customer={c}
                      onEdit={onEdit}
                      onView={onView}
                      archived={archived}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
