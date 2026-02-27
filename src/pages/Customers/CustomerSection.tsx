import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { CustomerRow } from './CustomerRow';
import type { Customer } from '../../types';

interface CustomerSectionProps {
  title:         string;
  customers:     Customer[];
  onEdit:        (c: Customer) => void;
  onView:        (c: Customer) => void;
  defaultOpen?:  boolean;
  collapsible?:  boolean;
  archived?:     boolean;
}

const TABLE_HEADERS = [
  { label: 'Customer',      className: '' },
  { label: 'Health',        className: 'hidden sm:table-cell' },
  { label: 'Alerts',        className: 'hidden md:table-cell' },
  { label: 'Tier',          className: 'hidden lg:table-cell' },
  { label: 'Last Sync',     className: 'hidden lg:table-cell' },
  { label: 'Assigned Tech', className: 'hidden xl:table-cell' },
  { label: '',              className: '' },
];

export function CustomerSection({
  title, customers, onEdit, onView, defaultOpen = true, collapsible, archived,
}: CustomerSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

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
              <thead>
                <tr className="border-b border-border">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider',
                        h.className,
                      )}
                    >
                      {h.label}
                    </th>
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
