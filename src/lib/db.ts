/**
 * Data access layer — all Supabase queries live here.
 * Components and hooks import from this file, never from supabase.ts directly.
 */

import { supabase } from './supabase';
import type { Customer, Alert, LogEntry, BackupJob } from '../types';
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
