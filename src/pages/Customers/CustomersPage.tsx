import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { CustomerSection } from './CustomerSection';
import { CustomerForm } from './CustomerForm';
import { useCustomers } from '../../hooks/useCustomers';
import { useAuth } from '../../context/AuthContext';
import type { Customer } from '../../types';

export function CustomersPage() {
  const [searchParams]                 = useSearchParams();
  const navigate                       = useNavigate();
  const [query, setQuery]              = useState(searchParams.get('q') ?? '');
  const [formOpen, setFormOpen]        = useState(false);
  const [editing, setEditing]          = useState<Customer | null>(null);

  const { profile } = useAuth();
  const isRestricted = profile?.role === 'viewer' || profile?.role === 'technician';

  const { customers, loading, error, reload, addCustomer, editCustomer } = useCustomers();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.domain?.toLowerCase().includes(q)) ||
      c.primaryContact.name.toLowerCase().includes(q) ||
      c.assignedTech.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const active    = filtered.filter(c => c.status === 'active');
  const potential = filtered.filter(c => c.status === 'potential');
  const archived  = filtered.filter(c => c.status === 'archived');

  function openEdit(c: Customer) { setEditing(c); setFormOpen(true); }
  function openAdd()              { setEditing(null); setFormOpen(true); }
  function handleView(c: Customer) {
    navigate(`/customers/${c.id}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {isRestricted
              ? `${customers.length} customer${customers.length !== 1 ? 's' : ''}`
              : `${customers.filter(c => c.status === 'active').length} active · ${customers.filter(c => c.status === 'potential').length} potential`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={reload} aria-label="Refresh" disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {!isRestricted && (
            <Button variant="primary" onClick={openAdd} leftIcon={<Plus className="size-4" />}>
              Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="max-w-sm">
        <Input
          leftIcon={<Search className="size-3.5" />}
          placeholder="Filter customers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter customers"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={reload} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Sections */}
      {!loading && (
        <>
          <CustomerSection title="Active" customers={active} onEdit={openEdit} onView={handleView} defaultOpen />
          {!isRestricted && (
            <>
              <CustomerSection title="Potential" customers={potential} onEdit={openEdit} onView={handleView} defaultOpen />
              <CustomerSection title="Archived"  customers={archived}  onEdit={openEdit} onView={handleView}
                defaultOpen={false} collapsible archived />
            </>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={async data => {
          if (editing) {
            await editCustomer(editing.id, data);
          } else {
            await addCustomer(data);
          }
        }}
        initial={editing}
      />
    </div>
  );
}
