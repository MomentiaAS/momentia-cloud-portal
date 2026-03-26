import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus, RefreshCw, Shield, Eye, Wrench, AlertCircle, X,
  ChevronDown, ChevronUp, Trash2, Check,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../components/ui/cn';
import { useProfiles, type CreateUserPayload } from '../../hooks/useProfiles';
import { useCustomers } from '../../hooks/useCustomers';
import type { UserRole } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';
import { uploadAvatarForUser, removeAvatarForUser } from '../../lib/avatars';
import { supabase } from '../../lib/supabase';

// ── Role metadata ────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'superadmin', label: 'Super Admin', icon: Shield, color: 'text-accent' },
  { value: 'admin',      label: 'Admin',       icon: Shield, color: 'text-blue-500' },
  { value: 'technician', label: 'Technician',  icon: Wrench, color: 'text-emerald-500' },
  { value: 'viewer',     label: 'Customer',    icon: Eye,    color: 'text-text-muted' },
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
  'appearance-none',
);

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportUsersToCsv(rows: Array<{ name: string; email: string; role: string }>) {
  const header = ['Name', 'Email', 'Role'];
  const csvRows = rows.map(r => [r.name, r.email, r.role].map(csvEscape));
  const csv = ['\uFEFF' + header.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  downloadTextFile(`users_export_${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
}

function exportUsersToPdf(rows: Array<{ name: string; email: string; role: string }>) {
  const now = new Date().toLocaleString();
  const bodyRows = rows.map(r => `
    <tr>
      <td>${r.name || '—'}</td>
      <td>${r.email}</td>
      <td>${r.role}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Users — ${now}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px;
         text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
  </style>
</head>
<body>
  <h1>Users</h1>
  <p class="meta">Exported ${now} · ${rows.length} user${rows.length !== 1 ? 's' : ''}</p>
  <table>
    <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    window.alert('PDF export blocked by the browser.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => iframe.remove(), 500);
    }
  }, 150);
}

// ── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreate, allCustomers }: {
  onClose:       () => void;
  onCreate:      (p: CreateUserPayload) => Promise<void>;
  allCustomers:  { id: string; name: string }[];
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [role,     setRole]     = useState<UserRole>('technician');
  const [initialCustomerId, setInitialCustomerId] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const needsCustomerScope = role === 'technician' || role === 'viewer';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) return;
    if (needsCustomerScope && !initialCustomerId) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        name: fullName,
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
        initialCustomerId: needsCustomerScope ? initialCustomerId : undefined,
      });
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
              <strong>{email}</strong> can sign in immediately with the password you set.
            </p>
            <Button variant="primary" size="sm" onClick={onClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" autoComplete="off">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">First name</label>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  autoComplete="off"
                  name="create-user-first-name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Last name</label>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  autoComplete="off"
                  name="create-user-last-name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  name="create-user-email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Phone</label>
                <input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Role</label>
                <select className={cn(inputClass, 'bg-surface')} value={role} onChange={e => setRole(e.target.value as UserRole)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  name="create-user-password"
                />
              </div>
              {needsCustomerScope && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Initial Customer Access
                  </label>
                  <select
                    className={cn(inputClass, 'bg-surface')}
                    value={initialCustomerId}
                    onChange={e => setInitialCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Select a customer…</option>
                    {allCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted">
              User is created as an active account (no email verification step).
              {needsCustomerScope && ' Technician/viewer users need at least one customer assignment.'}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={busy || !firstName.trim() || !lastName.trim() || !email.trim() || !password || (needsCustomerScope && !initialCustomerId)}
              >
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
  profile:              import('../../context/AuthContext').Profile;
  expanded:             boolean;
  onToggleExpanded:     () => void;
  isSelf:               boolean;
  isSuperAdmin:         boolean;
  /** Superadmin or admin — may edit display names (RLS must allow). */
  canEditUserNames:     boolean;
  allCustomers:         { id: string; name: string }[];
  onRoleChange:         (id: string, role: UserRole) => Promise<void>;
  onNameSave:           (id: string, name: string) => Promise<void>;
  onSetPassword:        (id: string, password: string) => Promise<void>;
  onDelete:             (id: string, name: string) => void;
  onFetchAssignments:   (userId: string) => Promise<string[]>;
  onSaveAssignments:    (userId: string, ids: string[]) => Promise<void>;
}

function UserRow({
  profile, expanded, onToggleExpanded, isSelf, isSuperAdmin, canEditUserNames, allCustomers, onRoleChange, onNameSave, onSetPassword, onDelete,
  onFetchAssignments, onSaveAssignments,
}: UserRowProps) {
  const [nameDraft,      setNameDraft]      = useState(profile.name ?? '');
  const [nameSaving,     setNameSaving]     = useState(false);
  const [nameSaved,      setNameSaved]      = useState(false);
  const [roleSaving,     setRoleSaving]     = useState(false);
  const [assignedIds,    setAssignedIds]    = useState<string[]>([]);
  const [loadedAssignedIds, setLoadedAssignedIds] = useState<string[]>([]);
  const [assignLoading,  setAssignLoading]  = useState(false);
  const [assignSaving,   setAssignSaving]   = useState(false);
  const [assignSaved,    setAssignSaved]    = useState(false);
  const [assignError,    setAssignError]    = useState<string | null>(null);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [passwordOpen,   setPasswordOpen]   = useState(false);
  const [passwordDraft,  setPasswordDraft]  = useState('');
  const [passwordBusy,   setPasswordBusy]   = useState(false);
  const [passwordSaved,  setPasswordSaved]  = useState(false);
  const [passwordError,  setPasswordError]  = useState<string | null>(null);
  const [avatarBusy,    setAvatarBusy]     = useState(false);
  const [avatarError,   setAvatarError]    = useState<string | null>(null);
  const assignMenuRef = useRef<HTMLDivElement | null>(null);

  const needsCustomerScope = profile.role === 'technician' || profile.role === 'viewer';

  const loadAssignments = useCallback(async () => {
    if (!needsCustomerScope) return;
    setAssignLoading(true);
    try {
      const ids = await onFetchAssignments(profile.id);
      setAssignedIds(ids);
      setLoadedAssignedIds(ids);
    } catch { /* ignore */ }
    setAssignLoading(false);
  }, [onFetchAssignments, profile.id, needsCustomerScope]);

  useEffect(() => {
    if (expanded) loadAssignments();
  }, [expanded, loadAssignments]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(e.target as Node)) {
        setAssignMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    setNameDraft(profile.name ?? '');
  }, [profile.id, profile.name]);

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
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not save name.');
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
      await onSaveAssignments(profile.id, assignedIds);
      setLoadedAssignedIds(assignedIds);
      setAssignSaved(true);
      setTimeout(() => setAssignSaved(false), 2000);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to save assignments.');
    } finally {
      setAssignSaving(false);
    }
  }

  async function handlePasswordSave() {
    if (!passwordDraft.trim()) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await onSetPassword(profile.id, passwordDraft.trim());
      setPasswordDraft('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to set password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!isSuperAdmin) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const { publicUrl } = await uploadAvatarForUser({ userId: profile.id, file });
      const urlWithBust = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithBust })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      // Parent will re-fetch profiles periodically; easiest is a full refresh.
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Failed to upload photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!isSuperAdmin) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await removeAvatarForUser(profile.id);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Failed to remove photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  const nameDraftTrimmed = nameDraft.trim();
  const currentNameTrimmed = (profile.name ?? '').trim();
  const canSaveName = canEditUserNames && !!nameDraftTrimmed && nameDraftTrimmed !== currentNameTrimmed;
  const canSaveAssignments = isSuperAdmin
    && needsCustomerScope
    && [...assignedIds].sort().join(',') !== [...loadedAssignedIds].sort().join(',');
  const hasPendingChanges = canSaveName || canSaveAssignments;

  async function handleCardSave() {
    if (!hasPendingChanges) return;
    if (canSaveName) {
      await handleNameSave();
    }
    if (canSaveAssignments) {
      await saveAssignments();
    }
  }

  return (
    <div className={cn(
      'border-b border-border last:border-0 transition-all',
      expanded && 'ring-1 ring-accent/40 bg-accent/5 rounded-lg mx-2 my-1 border-accent/30',
    )}>
      {/* Collapsed row */}
      <button
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-primary-50 dark:hover:bg-primary-800/20 transition-colors text-left"
        onClick={onToggleExpanded}
      >
        <Avatar name={profile.name ?? profile.email} size="sm" src={profile.avatar_url ?? null} />
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
              {canEditUserNames ? (
                <input
                  className={inputClass}
                  value={nameDraft}
                  onChange={e => { setNameDraft(e.target.value); setNameSaved(false); }}
                  onKeyDown={e => e.key === 'Enter' && void handleCardSave()}
                />
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

          {/* Profile photo (superadmin) */}
          {isSuperAdmin && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Profile photo</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className={cn(
                  'inline-flex items-center gap-2 text-xs font-medium text-accent hover:text-accent/80 cursor-pointer',
                  avatarBusy && 'opacity-60 pointer-events-none',
                )}>
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) void handleAvatarUpload(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {profile.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void handleAvatarRemove()}
                    className={cn(
                      'text-xs font-medium text-red-500 hover:text-red-600',
                      avatarBusy && 'opacity-60 pointer-events-none',
                    )}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
              <p className="text-xs text-text-muted">Superadmin can change photos for any user.</p>
            </div>
          )}

          {isSuperAdmin && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPasswordOpen(v => !v);
                  setPasswordError(null);
                  if (passwordOpen) setPasswordDraft('');
                }}
              >
                {passwordOpen ? 'Cancel' : 'Change password'}
              </Button>

              {passwordOpen && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 max-w-2xl">
                    <input
                      type="password"
                      className={inputClass}
                      value={passwordDraft}
                      onChange={e => { setPasswordDraft(e.target.value); setPasswordSaved(false); setPasswordError(null); }}
                      placeholder="New temporary password"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handlePasswordSave()}
                      disabled={passwordBusy || passwordDraft.trim().length < 8}
                    >
                      {passwordBusy ? 'Saving…' : 'Set password'}
                    </Button>
                  </div>
                  {passwordSaved && <p className="text-xs text-emerald-500">Password updated.</p>}
                  {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                  <p className="text-xs text-text-muted">Minimum 8 characters.</p>
                </div>
              )}
            </div>
          )}

          {/* Customer assignments — only for technician / viewer */}
          {needsCustomerScope && (
            <div className="space-y-2">
              {assignLoading ? (
                <p className="text-xs text-text-muted">Loading…</p>
              ) : allCustomers.length === 0 ? (
                <p className="text-xs text-text-muted italic">No customers in the system yet.</p>
              ) : (
                <div ref={assignMenuRef} className="relative max-w-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignMenuOpen(v => !v)}
                    rightIcon={assignMenuOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  >
                    Assigned customers ({assignedIds.length})
                  </Button>

                  {assignMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full min-w-[280px] bg-surface-raised border border-border rounded-lg shadow-popover p-2 max-h-56 overflow-y-auto">
                      {allCustomers.map(c => {
                        const checked = assignedIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={cn(
                              'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm select-none',
                              checked
                                ? 'bg-accent/10 text-text-primary'
                                : 'text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/30',
                              !isSuperAdmin && 'cursor-default pointer-events-none opacity-80',
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
            </div>
          )}

          {/* superadmin / admin note for unrestricted roles */}
          {!needsCustomerScope && (
            <p className="text-xs text-text-muted italic">
              This role has access to all customers — no customer scoping applies.
            </p>
          )}

          {/* Save/Delete actions */}
          <div className="flex items-center justify-between pt-1">
            {(canEditUserNames || (isSuperAdmin && needsCustomerScope)) ? (
              <div className="flex items-center gap-2">
                {(nameSaved || assignSaved) && (
                  <span className="text-xs text-emerald-500">Saved!</span>
                )}
                {assignError && <span className="text-xs text-red-500">{assignError}</span>}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleCardSave()}
                  disabled={nameSaving || assignSaving || !hasPendingChanges}
                >
                  {(nameSaving || assignSaving) ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <div />
            )}

            {isSuperAdmin && !isSelf && (
              <button
                onClick={() => onDelete(profile.id, profile.name ?? profile.email)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="size-3.5" />
                Remove user
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { profile: currentProfile }                         = useAuth();
  const { profiles, loading, error, fetchProfiles,
          updateRole, updateName, createUser, setUserPassword, deleteProfile,
          fetchAssignedCustomers, setCustomerAssignments }   = useProfiles();
  const { customers }                                       = useCustomers();

  const [showCreate,   setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [pageError,    setPageError]    = useState<string | null>(null);
  const [exportOpen, setExportOpen]     = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const isSuperAdmin = currentProfile?.role === 'superadmin';
  const canEditUserNames = isSuperAdmin || currentProfile?.role === 'admin';

  const allCustomers = customers.map(c => ({ id: c.id, name: c.name }));

  async function handleRoleChange(id: string, role: UserRole) {
    setPageError(null);
    try { await updateRole(id, role); }
    catch (err) { setPageError(err instanceof Error ? err.message : 'Failed to update role.'); }
  }

  async function handleNameSave(id: string, name: string) {
    setPageError(null);
    try {
      await updateName(id, name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update name.';
      setPageError(msg);
      throw err;
    }
  }

  async function handleSetPassword(id: string, password: string) {
    setPageError(null);
    try {
      await setUserPassword(id, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set password.';
      setPageError(msg);
      throw err;
    }
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

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const exportRows = profiles.map(p => ({
    name: p.name ?? '',
    email: p.email,
    role: ROLES.find(r => r.value === p.role)?.label ?? p.role,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage portal access, roles, and customer assignments.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div ref={exportRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(v => !v)}
              disabled={loading || exportRows.length === 0}
              rightIcon={exportOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            >
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-surface-raised border border-border rounded-lg shadow-popover z-20 py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                  onClick={() => { exportUsersToPdf(exportRows); setExportOpen(false); }}
                >
                  Export to PDF
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/40"
                  onClick={() => { exportUsersToCsv(exportRows); setExportOpen(false); }}
                >
                  Export to CSV
                </button>
              </div>
            )}
          </div>
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
                {r.value === 'viewer'     && 'Customer portal access'}
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
                  expanded={expandedUserId === p.id}
                  onToggleExpanded={() => setExpandedUserId(prev => (prev === p.id ? null : p.id))}
                  isSelf={p.id === currentProfile?.id}
                  isSuperAdmin={isSuperAdmin}
                  canEditUserNames={canEditUserNames}
                  allCustomers={allCustomers}
                  onRoleChange={handleRoleChange}
                  onNameSave={handleNameSave}
                  onSetPassword={handleSetPassword}
                  onDelete={(id, name) => setDeleteTarget({ id, name })}
                  onFetchAssignments={fetchAssignedCustomers}
                  onSaveAssignments={setCustomerAssignments}
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
          allCustomers={allCustomers}
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
