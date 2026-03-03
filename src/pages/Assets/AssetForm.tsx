import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';
import type { Asset, AssetType, AssetStatus } from '../../types';
import type { AssetPayload } from '../../hooks/useAssets';

const inputClass = cn(
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
  'disabled:opacity-50 transition-colors',
);

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'computer', label: 'Computer / Laptop' },
  { value: 'server',   label: 'Server' },
  { value: 'network',  label: 'Network Equipment' },
  { value: 'mobile',   label: 'Mobile Device' },
  { value: 'printer',  label: 'Printer' },
  { value: 'license',  label: 'License / Subscription' },
  { value: 'other',    label: 'Other' },
];

const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'active',  label: 'Active' },
  { value: 'spare',   label: 'Spare' },
  { value: 'retired', label: 'Retired' },
];

const BLANK: AssetPayload = {
  name: '', type: 'computer', make: '', model: '', serial: '',
  os: '', assignedTo: '', ipAddress: '', macAddress: '', location: '',
  status: 'active', purchaseDate: '', warrantyEnd: '', notes: '',
};

function toPayload(a: Asset): AssetPayload {
  return {
    name:         a.name,
    type:         a.type,
    make:         a.make         ?? '',
    model:        a.model        ?? '',
    serial:       a.serial       ?? '',
    os:           a.os           ?? '',
    assignedTo:   a.assignedTo   ?? '',
    ipAddress:    a.ipAddress    ?? '',
    macAddress:   a.macAddress   ?? '',
    location:     a.location     ?? '',
    status:       a.status,
    purchaseDate: a.purchaseDate ?? '',
    warrantyEnd:  a.warrantyEnd  ?? '',
    notes:        a.notes        ?? '',
  };
}

interface AssetFormProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (p: AssetPayload) => Promise<void>;
  initial?: Asset | null;
}

export function AssetForm({ open, onClose, onSave, initial }: AssetFormProps) {
  const [form,  setForm]  = useState<AssetPayload>(BLANK);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? toPayload(initial) : BLANK);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  function set(field: keyof AssetPayload, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl bg-surface-raised border border-border rounded-card shadow-modal max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">
            {initial ? 'Edit Asset' : 'Add Asset'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-text-primary focus-ring">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
              <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Identity */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Asset Name <span className="text-red-400">*</span></label>
                <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Type</label>
                <select className={cn(inputClass, 'bg-surface')} value={form.type} onChange={e => set('type', e.target.value)}>
                  {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Status</label>
                <select className={cn(inputClass, 'bg-surface')} value={form.status} onChange={e => set('status', e.target.value)}>
                  {ASSET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Make</label>
                <input className={inputClass} value={form.make} onChange={e => set('make', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Model</label>
                <input className={inputClass} value={form.model} onChange={e => set('model', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Serial Number</label>
                <input className={inputClass} value={form.serial} onChange={e => set('serial', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Operating System</label>
                <input className={inputClass} value={form.os} onChange={e => set('os', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Assigned To</label>
                <input className={inputClass} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">IP Address</label>
                <input className={inputClass} value={form.ipAddress} onChange={e => set('ipAddress', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">MAC Address</label>
                <input className={inputClass} value={form.macAddress} onChange={e => set('macAddress', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Location</label>
                <input className={inputClass} value={form.location} onChange={e => set('location', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Dates */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Dates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Purchase Date</label>
                <input type="date" className={inputClass} value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Warranty Expiry</label>
                <input type="date" className={inputClass} value={form.warrantyEnd} onChange={e => set('warrantyEnd', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Notes</p>
            <textarea
              rows={3}
              className={cn(inputClass, 'h-auto py-2 resize-none')}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </section>

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={busy || !form.name.trim()} onClick={handleSubmit}>
            {busy ? 'Saving…' : initial ? 'Save Changes' : 'Add Asset'}
          </Button>
        </div>
      </div>
    </div>
  );
}
