import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, RefreshCw, Shield, Eye, Wrench, AlertCircle, X,
  ChevronDown, ChevronUp, Trash2, Check, Pencil,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../components/ui/cn';
import { useProfiles, type CreateUserPayload } from '../../hooks/useProfiles';
import { useCustomers } from '../../hooks/useCustomers';
import type { UserRole } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

// ── Role metadata ────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'superadmin', label: 'Super Admin', icon: Shield, color: 'text-accent' },
  { value: 'admin',      label: 'Admin',       icon: Shield, color: 'text-blue-500' },
  { value: 'technician', label: 'Technician',  icon: Wrench, color: 'text-emerald-500' },
  { value: 'viewer',     label: 'Viewer',      icon: Eye,    color: 'text-text-muted' },
];

function RoleBadge({ role }: { role: UserRole }) {
  const r = ROLES.find(x => x.value === role) ?? ROLES[2];
  const Icon = r.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', r.color)}>
      <Icon className="size-3" />
      {r.label}
    </span>
  );
}

// ── Shared input style ───────────────────────────────────────────────────────

const inputClass = cn(
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary',
  'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
);

// ── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreate }: {
  onClose:  () => void;
  onCreate: (p: CreateUserPayload) => Promise<void>;
}) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<UserRole>('technician');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), email: email.trim(), password, role });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-surface-raised border border-border rounded-card shadow-modal">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Add User</h2>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-text-primary focus-ring">
            <X className="size-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check className="size-5 text-emerald-500" />
            </div>
            <p className="font-semibold text-text-primary">User created!</p>
            <p className="text-sm text-text-muted">
              A confirmation email has been sent to <strong>{email}</strong>.
              They must confirm before logging in.
            </p>
            <Button variant="primary" size="sm" onClick={onClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Full Name</label>
                <input className={inputClass} value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Temporary Password</label>
                <input type="password" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Role</label>
                <select className={cn(inputClass, 'bg-surface')} value={role} onChange={e => setRole(e.target.value as UserRole)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              The user receives a confirmation email and must verify before signing in.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={busy || !name || !email || !password}>
                {busy ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onCancel, busy }: {
  name:      string;
  onConfirm: () => void;
  onCancel:  () => void;
  busy:      boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-surface-raised border border-border rounded-card shadow-modal p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <Trash2 className="size-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Remove user?</p>
            <p className="text-xs text-text-muted mt-1">
              <strong>{name}</strong> will lose access immediately. This cannot be undone from the portal.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            className="bg-red-500 hover:bg-red-600 focus:ring-red-500/40"
          >
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Expanded user row ─────────────────────────────────────────────────────────

interface UserRowProps {
  profile:           import('../../context/AuthContext').Profile;
  isSelf:            boolean;
  isSuperAdmin:      boolean;
  allCustomers:      { id: string; name: string }[];
  onRoleChange:      (id: string, role: UserRole) => Promise<void>;
  onNameSave:        (id: string, name: string) => Promise<void>;
  onDelete:          (id: string, name: string) => void;
}

function UserRow({
  profile, isSelf, isSuperAdmin, allCustomers, onRoleChange, onNameSave, onDelete,
}: UserRowProps) {
  const {
    fetchAssignedCustomers,
    setCustomerAssignments,
  } = useProfiles();

  const [expanded,       setExpanded]       = useState(false);
  const [nameDraft,      setNameDraft]      = useState(profile.name ?? '');
  const [nameSaving,     setNameSaving]     = useState(false);
  const [nameSaved,      setNameSaved]      = useState(false);
  const [roleSaving,     setRoleSaving]     = useState(false);
  const [assignedIds,    setAssignedIds]    = useState<string[]>([]);
  const [assignLoading,  setAssignLoading]  = useState(false);
  const [assignSaving,   setAssignSaving]   = useState(false);
  const [assignSaved,    setAssignSaved]    = useState(false);
  const [assignError,    setAssignError]    = useState<string | null>(null);

  const needsCustomerScope = profile.role === 'technician' || profile.role === 'viewer';

  const loadAssignments = useCallback(async () => {
    if (!needsCustomerScope) return;
    setAssignLoading(true);
    try {
      const ids = await fetchAssignedCustomers(profile.id);
      setAssignedIds(ids);
    } catch { /* ignore */ }
    setAssignLoading(false);
  }, [fetchAssignedCustomers, profile.id, needsCustomerScope]);

  useEffect(() => {
    if (expanded) loadAssignments();
  }, [expanded, loadAssignments]);

  async function handleRoleChange(newRole: UserRole) {
    setRoleSaving(true);
    try {
      await onRoleChange(profile.id, newRole);
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleNameSave() {
    if (!nameDraft.trim()) return;
    setNameSaving(true);
    try {
      await onNameSave(profile.id, nameDraft);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } finally {
      setNameSaving(false);
    }
  }

  function toggleCustomer(cid: string) {
    setAssignedIds(prev =>
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid],
    );
    setAssignSaved(false);
  }

  async function saveAssignments() {
    setAssignSaving(true);
    setAssignError(null);
    try {
      await setCustomerAssignments(profile.id, assignedIds);
      setAssignSaved(true);
      setTimeout(() => setAssignSaved(false), 2000);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to save assignments.');
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <div className="border-b border-border last:border-0">
      {/* Collapsed row */}
      <button
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-primary-50 dark:hover:bg-primary-800/20 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <Avatar name={profile.name ?? profile.email} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{profile.name ?? '—'}</p>
            {isSelf && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-700/40 text-text-muted">
                You
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">{profile.email}</p>
        </div>
        <div className="hidden sm:block shrink-0">
          <RoleBadge role={profile.role} />
        </div>
        {expanded
          ? <ChevronUp className="size-4 text-text-muted shrink-0" />
          : <ChevronDown className="size-4 text-text-muted shrink-0" />
        }
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-6 pb-5 pt-1 space-y-5 bg-primary-50/50 dark:bg-primary-800/10">

          {/* Identity fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Full Name</label>
              {isSuperAdmin ? (
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={nameDraft}
                    onChange={e => { setNameDraft(e.target.value); setNameSaved(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={nameSaving || !nameDraft.trim()}
                    className="h-9 px-2.5 rounded-lg border border-border bg-surface text-text-secondary hover:text-accent hover:border-accent disabled:opacity-50 transition-colors"
                    title="Save name"
                  >
                    {nameSaved ? <Check className="size-3.5 text-emerald-500" /> : <Pencil className="size-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="h-9 flex items-center px-3 text-sm text-text-primary">{profile.name ?? '—'}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
              <p className="h-9 flex items-center px-3 text-sm text-text-muted truncate">{profile.email}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Role</label>
              {isSuperAdmin && !isSelf ? (
                <select
                  className={cn(inputClass, 'bg-surface')}
                  value={profile.role}
                  disabled={roleSaving}
                  onChange={e => handleRoleChange(e.target.value as UserRole)}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              ) : (
                <div className="h-9 flex items-center px-3">
                  <RoleBadge role={profile.role} />
                  {isSelf && (
                    <span className="ml-2 text-xs text-text-muted">(can't change own role)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer assignments — only for technician / viewer */}
          {needsCustomerScope && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Assigned Customers
                </p>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    {assignSaved && <span className="text-xs text-emerald-500">Saved!</span>}
                    {assignError && <span className="text-xs text-red-500">{assignError}</span>}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveAssignments}
                      disabled={assignSaving}
                    >
                      {assignSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>

              {assignLoading ? (
                <p className="text-xs text-text-muted">Loading…</p>
              ) : allCustomers.length === 0 ? (
                <p className="text-xs text-text-muted italic">No customers in the system yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {allCustomers.map(c => {
                    const checked = assignedIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm select-none',
                          checked
                            ? 'border-accent/50 bg-accent/5 text-text-primary'
                            : 'border-border bg-surface text-text-secondary hover:border-border/80',
                          !isSuperAdmin && 'cursor-default pointer-events-none',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isSuperAdmin}
                          onChange={() => isSuperAdmin && toggleCustomer(c.id)}
                          className="accent-accent size-3.5 shrink-0"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* superadmin / admin note for unrestricted roles */}
          {!needsCustomerScope && (
            <p className="text-xs text-text-muted italic">
              This role has access to all customers — no customer scoping applies.
            </p>
          )}

          {/* Delete — superadmin only, not self */}
          {isSuperAdmin && !isSelf && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => onDelete(profile.id, profile.name ?? profile.email)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="size-3.5" />
                Remove user
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { profile: currentProfile }                         = useAuth();
  const { profiles, loading, error, fetchProfiles,
          updateRole, updateName, createUser, deleteProfile } = useProfiles();
  const { customers }                                       = useCustomers();

  const [showCreate,   setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [pageError,    setPageError]    = useState<string | null>(null);

  const isSuperAdmin = currentProfile?.role === 'superadmin';

  const allCustomers = customers.map(c => ({ id: c.id, name: c.name }));

  async function handleRoleChange(id: string, role: UserRole) {
    setPageError(null);
    try { await updateRole(id, role); }
    catch (err) { setPageError(err instanceof Error ? err.message : 'Failed to update role.'); }
  }

  async function handleNameSave(id: string, name: string) {
    await updateName(id, name);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteProfile(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to remove user.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage portal access, roles, and customer assignments.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={fetchProfiles} aria-label="Refresh">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
          {isSuperAdmin && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus className="size-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Page-level errors */}
      {(pageError || deleteError) && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
          <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{pageError ?? deleteError}</p>
        </div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.value} className="flex items-center gap-1.5 text-xs text-text-muted">
              <Icon className={cn('size-3', r.color)} />
              <span className={r.color}>{r.label}</span>
              <span>—</span>
              <span>
                {r.value === 'superadmin' && 'Full access, manage users'}
                {r.value === 'admin'      && 'Full data access, view users'}
                {r.value === 'technician' && 'Edit assigned customers'}
                {r.value === 'viewer'     && 'View assigned customers'}
              </span>
            </div>
          );
        })}
      </div>

      {/* User list */}
      <Card>
        <CardHeader
          title="Portal Users"
          subtitle={`${profiles.length} user${profiles.length !== 1 ? 's' : ''} — click a row to expand`}
        />
        <CardBody className="p-0">
          {error && <p className="px-6 py-4 text-sm text-red-500">{error}</p>}

          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="skeleton size-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3.5 w-32 rounded" />
                    <div className="skeleton h-3 w-48 rounded" />
                  </div>
                  <div className="skeleton h-4 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {profiles.map(p => (
                <UserRow
                  key={p.id}
                  profile={p}
                  isSelf={p.id === currentProfile?.id}
                  isSuperAdmin={isSuperAdmin}
                  allCustomers={allCustomers}
                  onRoleChange={handleRoleChange}
                  onNameSave={handleNameSave}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                />
              ))}
              {profiles.length === 0 && (
                <p className="px-6 py-10 text-sm text-center text-text-muted">No users found.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreate={createUser}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          busy={deleteBusy}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        />
      )}
    </div>
  );
}
