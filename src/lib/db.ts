/**
 * Data access layer — all Supabase queries live here.
 * Components and hooks import from this file, never from supabase.ts directly.
 */

import { supabase } from './supabase';
import type {
  Customer,
  Alert,
  LogEntry,
  BackupJob,
  Asset,
  CustomerDocSection,
  CustomerFileNode,
} from '../types';
import type { Profile } from '../context/AuthContext';

// ── Type for the raw DB row shapes ────────────────────────────────────────────

type DbCustomer = {
  id: string; name: string; status: string; health: string; tier: string;
  open_alerts: number; last_sync: string | null; assigned_tech: string | null;
  primary_contact: object; billing_contact: object | null;
  domain: string | null; address: string | null; state: string | null;
  notes: string | null; integrations: object; unifi_site_id: string | null;
  created_at: string;
};

type DbAlert = {
  id: string; customer_id: string | null; title: string; message: string | null;
  severity: string; timestamp: string; resolved: boolean; source: string | null;
};

type DbLog = {
  id: string; customer_id: string | null; system: string; severity: string;
  message: string; details: string | null; timestamp: string;
};

type DbBackupJob = {
  id: string; customer_id: string; job_name: string; status: string;
  last_run: string | null; next_run: string | null; duration: number | null;
  size_gb: number | null; data_source: string | null; repository: string | null;
  retention_days: number; error_message: string | null;
};

type DbAsset = {
  id: string; customer_id: string; name: string; type: string;
  make: string | null; model: string | null; serial: string | null;
  os: string | null; assigned_to: string | null; status: string;
  ip_address: string | null; mac_address: string | null; location: string | null;
  purchase_date: string | null; warranty_end: string | null;
  notes: string | null; created_at: string;
};

type DbDocSection = {
  id: string; customer_id: string; title: string; body: string;
  sort_order: number; created_at: string; updated_at: string;
};

type DbCustomerFile = {
  id: string; customer_id: string; parent_id: string | null; kind: string;
  name: string; storage_path: string | null; mime_type: string | null;
  size_bytes: number | null; created_at: string; created_by: string | null;
};

const CUSTOMER_FILES_BUCKET = 'customer-files';
const MAX_CUSTOMER_FILE_BYTES = 50 * 1024 * 1024;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toCustomer(r: DbCustomer): Customer {
  return {
    id:             r.id,
    name:           r.name,
    status:         r.status as Customer['status'],
    health:         r.health as Customer['health'],
    tier:           r.tier as Customer['tier'],
    openAlerts:     r.open_alerts,
    lastSync:       r.last_sync ?? new Date().toISOString(),
    assignedTech:   r.assigned_tech ?? '',
    primaryContact: r.primary_contact as Customer['primaryContact'],
    billingContact: r.billing_contact as Customer['billingContact'] ?? undefined,
    domain:         r.domain   ?? undefined,
    address:        r.address  ?? undefined,
    state:          r.state    ?? undefined,
    notes:          r.notes    ?? undefined,
    integrations:   r.integrations as Customer['integrations'],
    unifiSiteId:    r.unifi_site_id ?? undefined,
    createdAt:      r.created_at,
  };
}

function toAlert(r: DbAlert): Alert {
  return {
    id:         r.id,
    customerId: r.customer_id ?? '',
    title:      r.title,
    message:    r.message ?? '',
    severity:   r.severity as Alert['severity'],
    timestamp:  r.timestamp,
    resolved:   r.resolved,
    source:     r.source ?? '',
  };
}

function toLog(r: DbLog): LogEntry {
  return {
    id:         r.id,
    customerId: r.customer_id ?? undefined,
    system:     r.system,
    severity:   r.severity as LogEntry['severity'],
    message:    r.message,
    details:    r.details ?? undefined,
    timestamp:  r.timestamp,
  };
}

function toBackupJob(r: DbBackupJob): BackupJob {
  return {
    id:           r.id,
    customerId:   r.customer_id,
    jobName:      r.job_name,
    status:       r.status as BackupJob['status'],
    lastRun:      r.last_run ?? new Date().toISOString(),
    nextRun:      r.next_run ?? undefined,
    duration:     r.duration ?? undefined,
    sizeGb:       r.size_gb ?? undefined,
    dataSource:   r.data_source ?? '',
    repository:   r.repository ?? '',
    retentionDays: r.retention_days,
    errorMessage: r.error_message ?? undefined,
  };
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function fetchCustomerById(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return toCustomer(data as DbCustomer);
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return (data as DbCustomer[]).map(toCustomer);
}

export async function insertCustomer(payload: {
  name: string; status: string; tier: string; domain?: string;
  address?: string; state?: string; assignedTech?: string; notes?: string;
  primaryContact: object; secondaryContact?: object; integrations: object;
  unifiSiteId?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name:            payload.name,
      status:          payload.status,
      tier:            payload.tier,
      domain:          payload.domain          || null,
      address:         payload.address         || null,
      state:           payload.state           || null,
      assigned_tech:   payload.assignedTech    || null,
      notes:           payload.notes           || null,
      primary_contact: payload.primaryContact,
      billing_contact: payload.secondaryContact || null,
      integrations:    payload.integrations,
      unifi_site_id:   payload.unifiSiteId     || null,
      health:          'unknown',
      open_alerts:     0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toCustomer(data as DbCustomer);
}

export async function updateCustomer(id: string, payload: {
  name?: string; status?: string; tier?: string; domain?: string;
  address?: string; state?: string; assignedTech?: string; notes?: string;
  primaryContact?: object; secondaryContact?: object | null; integrations?: object;
  unifiSiteId?: string | null; health?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...(payload.name            && { name:            payload.name }),
      ...(payload.status          && { status:          payload.status }),
      ...(payload.tier            && { tier:            payload.tier }),
      ...(payload.domain          != null && { domain:         payload.domain || null }),
      ...(payload.address          != null && { address:         payload.address || null }),
      ...(payload.state            != null && { state:           payload.state || null }),
      ...(payload.assignedTech     != null && { assigned_tech:   payload.assignedTech || null }),
      ...(payload.notes            != null && { notes:           payload.notes || null }),
      ...(payload.primaryContact   && { primary_contact:  payload.primaryContact }),
      ...(payload.secondaryContact !== undefined && { billing_contact: payload.secondaryContact }),
      ...(payload.integrations     && { integrations:     payload.integrations }),
      ...(payload.unifiSiteId      !== undefined && { unifi_site_id: payload.unifiSiteId || null }),
      ...(payload.health           !== undefined && { health:         payload.health }),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toCustomer(data as DbCustomer);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function fetchAlertsByCustomer(customerId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('customer_id', customerId)
    .order('timestamp', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbAlert[]).map(toAlert);
}

export async function fetchAlerts(resolvedFilter?: boolean): Promise<Alert[]> {
  let query = supabase.from('alerts').select('*').order('timestamp', { ascending: false });
  if (resolvedFilter !== undefined) query = query.eq('resolved', resolvedFilter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as DbAlert[]).map(toAlert);
}

export async function resolveAlert(id: string): Promise<void> {
  const { error } = await supabase.from('alerts').update({ resolved: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function fetchLogsByCustomer(customerId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('customer_id', customerId)
    .order('timestamp', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as DbLog[]).map(toLog);
}

export async function fetchLogs(): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as DbLog[]).map(toLog);
}

// ── Backup Jobs ───────────────────────────────────────────────────────────────

export async function fetchBackupJobsByCustomer(customerId: string): Promise<BackupJob[]> {
  const { data, error } = await supabase
    .from('backup_jobs')
    .select('*')
    .eq('customer_id', customerId)
    .order('last_run', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbBackupJob[]).map(toBackupJob);
}

export async function fetchAssignedUsersByCustomer(customerId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('user_customers')
    .select('profiles(*)')
    .eq('customer_id', customerId);
  if (error) throw new Error(error.message);
  return (data as unknown as { profiles: Profile }[]).map(r => r.profiles).filter(Boolean);
}

export async function fetchBackupJobs(): Promise<BackupJob[]> {
  const { data, error } = await supabase
    .from('backup_jobs')
    .select('*')
    .order('last_run', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbBackupJob[]).map(toBackupJob);
}

// ── Assets ────────────────────────────────────────────────────────────────────

function toDocSection(r: DbDocSection): CustomerDocSection {
  return {
    id:         r.id,
    customerId: r.customer_id,
    title:      r.title,
    body:       r.body,
    sortOrder:  r.sort_order,
    createdAt:  r.created_at,
    updatedAt:  r.updated_at,
  };
}

function toCustomerFile(r: DbCustomerFile): CustomerFileNode {
  return {
    id:          r.id,
    customerId:  r.customer_id,
    parentId:    r.parent_id,
    kind:        r.kind as CustomerFileNode['kind'],
    name:        r.name,
    storagePath: r.storage_path ?? undefined,
    mimeType:    r.mime_type ?? undefined,
    sizeBytes:   r.size_bytes ?? undefined,
    createdAt:   r.created_at,
    createdBy:   r.created_by ?? undefined,
  };
}

function toAsset(r: DbAsset): Asset {
  return {
    id:           r.id,
    customerId:   r.customer_id,
    name:         r.name,
    type:         r.type as Asset['type'],
    make:         r.make        ?? undefined,
    model:        r.model       ?? undefined,
    serial:       r.serial      ?? undefined,
    os:           r.os          ?? undefined,
    assignedTo:   r.assigned_to ?? undefined,
    ipAddress:    r.ip_address  ?? undefined,
    macAddress:   r.mac_address ?? undefined,
    location:     r.location    ?? undefined,
    status:       r.status as Asset['status'],
    purchaseDate: r.purchase_date ?? undefined,
    warrantyEnd:  r.warranty_end  ?? undefined,
    notes:        r.notes        ?? undefined,
    createdAt:    r.created_at,
  };
}

export async function fetchAssetsByCustomer(customerId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('customer_id', customerId)
    .order('name');
  if (error) throw new Error(error.message);
  return (data as DbAsset[]).map(toAsset);
}

export async function fetchAllAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return (data as DbAsset[]).map(toAsset);
}

export interface AssetPayload {
  name: string; type: string; make?: string; model?: string;
  serial?: string; os?: string; assignedTo?: string;
  ipAddress?: string; macAddress?: string; location?: string;
  status: string; purchaseDate?: string; warrantyEnd?: string; notes?: string;
}

export async function insertAsset(customerId: string, p: AssetPayload): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      customer_id:   customerId,
      name:          p.name,
      type:          p.type,
      make:          p.make          || null,
      model:         p.model         || null,
      serial:        p.serial        || null,
      os:            p.os            || null,
      assigned_to:   p.assignedTo    || null,
      ip_address:    p.ipAddress     || null,
      mac_address:   p.macAddress    || null,
      location:      p.location      || null,
      status:        p.status,
      purchase_date: p.purchaseDate  || null,
      warranty_end:  p.warrantyEnd   || null,
      notes:         p.notes         || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toAsset(data as DbAsset);
}

export async function updateAsset(id: string, p: AssetPayload): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .update({
      name:          p.name,
      type:          p.type,
      make:          p.make          || null,
      model:         p.model         || null,
      serial:        p.serial        || null,
      os:            p.os            || null,
      assigned_to:   p.assignedTo    || null,
      ip_address:    p.ipAddress     || null,
      mac_address:   p.macAddress    || null,
      location:      p.location      || null,
      status:        p.status,
      purchase_date: p.purchaseDate  || null,
      warranty_end:  p.warrantyEnd   || null,
      notes:         p.notes         || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toAsset(data as DbAsset);
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Customer documentation sections ───────────────────────────────────────────

export async function fetchDocSectionsByCustomer(customerId: string): Promise<CustomerDocSection[]> {
  const { data, error } = await supabase
    .from('customer_doc_sections')
    .select('*')
    .eq('customer_id', customerId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbDocSection[]).map(toDocSection);
}

export interface DocSectionPayload {
  title: string;
  body: string;
  sortOrder: number;
}

export async function insertDocSection(customerId: string, p: DocSectionPayload): Promise<CustomerDocSection> {
  const { data, error } = await supabase
    .from('customer_doc_sections')
    .insert({
      customer_id: customerId,
      title:       p.title.trim() || 'Untitled',
      body:        p.body ?? '',
      sort_order:  p.sortOrder,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toDocSection(data as DbDocSection);
}

export async function updateDocSection(id: string, p: DocSectionPayload): Promise<CustomerDocSection> {
  const { data, error } = await supabase
    .from('customer_doc_sections')
    .update({
      title:      p.title.trim() || 'Untitled',
      body:       p.body ?? '',
      sort_order: p.sortOrder,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toDocSection(data as DbDocSection);
}

export async function deleteDocSection(id: string): Promise<void> {
  const { error } = await supabase.from('customer_doc_sections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Customer files (folders + Storage-backed files) ───────────────────────────

function sanitizePathSegment(name: string): string {
  const t = name.replace(/^.*[/\\]/, '').trim() || 'file';
  const safe = t.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return safe || 'file';
}

function displayFileName(file: File): string {
  const t = file.name.replace(/^.*[/\\]/, '').trim();
  return t.slice(0, 500) || 'file';
}

/** All nodes for a customer (client builds folder view by parentId). */
export async function fetchCustomerFiles(customerId: string): Promise<CustomerFileNode[]> {
  const { data, error } = await supabase
    .from('customer_files')
    .select('*')
    .eq('customer_id', customerId);
  if (error) throw new Error(error.message);
  const rows = (data as DbCustomerFile[]).map(toCustomerFile);
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export async function insertCustomerFolder(
  customerId: string,
  parentId: string | null,
  name: string,
): Promise<CustomerFileNode> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name is required.');
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id ?? null;

  const { data, error } = await supabase
    .from('customer_files')
    .insert({
      customer_id:   customerId,
      parent_id:     parentId,
      kind:          'folder',
      name:          trimmed,
      storage_path:  null,
      mime_type:     null,
      size_bytes:    null,
      created_by:    uid,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toCustomerFile(data as DbCustomerFile);
}

export async function uploadCustomerLibraryFile(
  customerId: string,
  parentId: string | null,
  file: File,
): Promise<CustomerFileNode> {
  if (file.size > MAX_CUSTOMER_FILE_BYTES) {
    throw new Error('File is too large (max 50 MB).');
  }

  const displayName = displayFileName(file);
  const segment = sanitizePathSegment(file.name);
  const objectId = crypto.randomUUID();
  const storagePath = `${customerId}/${objectId}/${segment}`;

  const { error: upErr } = await supabase.storage
    .from(CUSTOMER_FILES_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
  if (upErr) throw new Error(upErr.message);

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id ?? null;

  const { data, error } = await supabase
    .from('customer_files')
    .insert({
      customer_id:   customerId,
      parent_id:     parentId,
      kind:          'file',
      name:          displayName,
      storage_path:  storagePath,
      mime_type:     file.type || null,
      size_bytes:    file.size,
      created_by:    uid,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(CUSTOMER_FILES_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  return toCustomerFile(data as DbCustomerFile);
}

function collectStoragePathsInSubtree(all: CustomerFileNode[], rootId: string): string[] {
  const byParent = new Map<string | null, CustomerFileNode[]>();
  for (const n of all) {
    const p = n.parentId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(n);
  }
  const paths: string[] = [];
  function walk(id: string) {
    const node = all.find(x => x.id === id);
    if (!node) return;
    if (node.kind === 'file' && node.storagePath) paths.push(node.storagePath);
    for (const k of byParent.get(id) ?? []) walk(k.id);
  }
  walk(rootId);
  return paths;
}

/** Removes Storage objects for all file descendants, then deletes the row (CASCADE removes child rows). */
export async function deleteCustomerFileNode(customerId: string, nodeId: string): Promise<void> {
  const all = await fetchCustomerFiles(customerId);
  const exists = all.some(n => n.id === nodeId);
  if (!exists) throw new Error('Item not found.');

  const paths = collectStoragePathsInSubtree(all, nodeId);
  if (paths.length > 0) {
    const { error: stErr } = await supabase.storage.from(CUSTOMER_FILES_BUCKET).remove(paths);
    if (stErr) throw new Error(stErr.message);
  }

  const { error } = await supabase.from('customer_files').delete().eq('id', nodeId);
  if (error) throw new Error(error.message);
}

export async function getCustomerFileSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CUSTOMER_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresSec);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Could not create download link.');
  return data.signedUrl;
}
