import { useState, useEffect } from 'react';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Customer, ServiceTier, CustomerStatus } from '../../types';
import type { CustomerFormPayload } from '../../hooks/useCustomers';
import { supabase } from '../../lib/supabase';

const DEFAULT: CustomerFormPayload = {
  name: '', status: 'active', tier: 'basic',
  domain: '', address: '', state: '', assignedTech: '',
  contactName: '', contactEmail: '', contactPhone: '', contactRole: '',
  secContactName: '', secContactEmail: '', secContactPhone: '', secContactRole: '',
  notes: '',
  veeam: false, rmm: false, m365: false, azure: false, sentinelOne: false,
  unifi: false, unifiSiteId: '',
};

/** Fetches display names for the technician dropdown. */
function useTechOptions() {
  const [techs, setTechs] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('role', ['superadmin', 'admin', 'technician'])
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setTechs(data.map(p => ({
            id:    p.name ?? p.email,
            label: p.name ?? p.email,
          })));
        }
      });
  }, []);
  return techs;
}

interface CustomerFormProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (data: CustomerFormPayload) => Promise<void>;
  initial?: Customer | null;
}

export function CustomerForm({ open, onClose, onSave, initial }: CustomerFormProps) {
  const techs = useTechOptions();
  const [form, setForm] = useState<CustomerFormPayload>(() => {
    if (!initial) return DEFAULT;
    const sec = initial.billingContact;
    return {
      name:           initial.name,
      status:         initial.status,
      tier:           initial.tier,
      domain:         initial.domain ?? '',
      address:        initial.address ?? '',
      state:          initial.state ?? '',
      assignedTech:   initial.assignedTech,
      contactName:    initial.primaryContact.name,
      contactEmail:   initial.primaryContact.email,
      contactPhone:   initial.primaryContact.phone ?? '',
      contactRole:    initial.primaryContact.role ?? '',
      secContactName:  sec?.name  ?? '',
      secContactEmail: sec?.email ?? '',
      secContactPhone: sec?.phone ?? '',
      secContactRole:  sec?.role  ?? '',
      notes:          initial.notes ?? '',
      veeam:          initial.integrations.veeam,
      rmm:            initial.integrations.rmm,
      m365:           initial.integrations.m365,
      azure:          initial.integrations.azure,
      sentinelOne:    initial.integrations.sentinelOne,
      unifi:          initial.integrations.unifi ?? false,
      unifiSiteId:    initial.unifiSiteId ?? '',
    };
  });

  const [errors,  setErrors]  = useState<Partial<Record<keyof CustomerFormPayload, string>>>({});
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim())         e.name = 'Customer name is required';
    if (!form.contactName.trim())  e.contactName = 'Contact name is required';
    if (!form.contactEmail.trim()) e.contactEmail = 'Contact email is required';
    else if (!/\S+@\S+\.\S+/.test(form.contactEmail)) e.contactEmail = 'Invalid email address';
    if (form.secContactEmail && !/\S+@\S+\.\S+/.test(form.secContactEmail))
      e.secContactEmail = 'Invalid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof CustomerFormPayload>(key: K, val: CustomerFormPayload[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const Toggle = ({ label, field }: { label: string; field: keyof CustomerFormPayload }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={!!form[field]}
        onChange={e => set(field as 'veeam', e.target.checked as never)}
        className="size-4 rounded accent-accent"
      />
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit — ${initial.name}` : 'Add Customer'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {initial ? 'Save Changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {saveErr && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {saveErr}
          </div>
        )}

        {/* Identity */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Identity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Name *"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              error={errors.name}
              className="sm:col-span-2"
            />
            <Select label="Status" value={form.status} onChange={e => set('status', e.target.value as CustomerStatus)}>
              <option value="active">Active</option>
              <option value="potential">Potential</option>
              <option value="archived">Archived</option>
            </Select>
            <Select label="Subscription" value={form.tier} onChange={e => set('tier', e.target.value as ServiceTier)}>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="advanced">Advanced</option>
            </Select>
            <Input
              label="Domain"
              value={form.domain}
              onChange={e => set('domain', e.target.value)}
            />
            <Input
              label="Address"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
            <Input
              label="State"
              value={form.state}
              onChange={e => set('state', e.target.value)}
            />
          </div>
        </section>

        {/* Primary Contact */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Primary Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              value={form.contactName}
              onChange={e => set('contactName', e.target.value)}
              error={errors.contactName}
            />
            <Input
              label="Email *"
              type="email"
              value={form.contactEmail}
              onChange={e => set('contactEmail', e.target.value)}
              error={errors.contactEmail}
            />
            <Input
              label="Phone"
              type="tel"
              value={form.contactPhone}
              onChange={e => set('contactPhone', e.target.value)}
            />
            <Input
              label="Role / Title"
              value={form.contactRole}
              onChange={e => set('contactRole', e.target.value)}
            />
          </div>
        </section>

        {/* Secondary Contact */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Secondary Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={form.secContactName}
              onChange={e => set('secContactName', e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={form.secContactEmail}
              onChange={e => set('secContactEmail', e.target.value)}
              error={errors.secContactEmail}
            />
            <Input
              label="Phone"
              type="tel"
              value={form.secContactPhone}
              onChange={e => set('secContactPhone', e.target.value)}
            />
            <Input
              label="Role / Title"
              value={form.secContactRole}
              onChange={e => set('secContactRole', e.target.value)}
            />
          </div>
        </section>

        {/* Technical */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Technical</h3>
          <Select
            label="Assigned Technician"
            value={form.assignedTech}
            onChange={e => set('assignedTech', e.target.value)}
          >
            <option value="">Unassigned</option>
            {techs.map(t => (
              <option key={t.id} value={t.label}>{t.label}</option>
            ))}
          </Select>
        </section>

        {/* Integrations */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Integrations</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Toggle label="Veeam B&R"     field="veeam" />
            <Toggle label="RMM"           field="rmm" />
            <Toggle label="Microsoft 365" field="m365" />
            <Toggle label="Azure"         field="azure" />
            <Toggle label="SentinelOne"   field="sentinelOne" />
            <Toggle label="UniFi Network" field="unifi" />
          </div>
          {form.unifi && (
            <div className="mt-3">
              <Input
                label="UniFi Site ID"
                value={form.unifiSiteId}
                onChange={e => set('unifiSiteId', e.target.value)}
                placeholder="e.g. 5f3e2a1b4c9d8e7f6a5b4c3d"
              />
              <p className="text-xs text-text-muted mt-1">
                Find your Site ID by going to Users → UniFi → Discover Sites in this portal after saving.
              </p>
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Notes</h3>
          <Textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </section>
      </div>
    </Modal>
  );
}
