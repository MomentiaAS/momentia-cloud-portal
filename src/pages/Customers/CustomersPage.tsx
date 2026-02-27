import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CustomerSection } from './CustomerSection';
import { CustomerForm } from './CustomerForm';
import { demoCustomers } from '../../data/demo';
import type { Customer } from '../../types';

export function CustomersPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery]       = useState(searchParams.get('q') ?? '');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return demoCustomers;
    return demoCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.domain?.toLowerCase().includes(q)) ||
      c.primaryContact.name.toLowerCase().includes(q) ||
      c.assignedTech.toLowerCase().includes(q),
    );
  }, [query]);

  const active    = filtered.filter(c => c.status === 'active');
  const potential = filtered.filter(c => c.status === 'potential');
  const archived  = filtered.filter(c => c.status === 'archived');

  function openEdit(c: Customer) { setEditing(c); setFormOpen(true); }
  function openAdd()              { setEditing(null); setFormOpen(true); }
  function handleView(c: Customer) {
    // Stub — would navigate to customer detail
    console.info('View customer', c.id);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {demoCustomers.filter(c => c.status === 'active').length} active ·{' '}
            {demoCustomers.filter(c => c.status === 'potential').length} potential
          </p>
        </div>
        <Button variant="primary" onClick={openAdd} leftIcon={<Plus className="size-4" />}>
          Add Customer
        </Button>
      </div>

      {/* Filter bar */}
      <div className="max-w-sm">
        <Input
          leftIcon={<Search className="size-3.5" />}
          placeholder="Filter customers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter customers"
        />
      </div>

      {/* Sections */}
      <CustomerSection
        title="Active"
        customers={active}
        onEdit={openEdit}
        onView={handleView}
        defaultOpen
      />
      <CustomerSection
        title="Potential"
        customers={potential}
        onEdit={openEdit}
        onView={handleView}
        defaultOpen
      />
      <CustomerSection
        title="Archived"
        customers={archived}
        onEdit={openEdit}
        onView={handleView}
        defaultOpen={false}
        collapsible
        archived
      />

      {/* Add / Edit form modal */}
      <CustomerForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={data => {
          // In a real app: dispatch to state/API
          console.info('Saved customer data', data);
        }}
        initial={editing}
      />
    </div>
  );
}
