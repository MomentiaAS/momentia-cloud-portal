import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../context/AuthContext';

export interface CreateUserPayload {
  name:              string;
  email:             string;
  phone?:            string;
  password:          string;
  role:              UserRole;
  initialCustomerId?: string;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (err) setError(err.message);
    else setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  async function updateRole(id: string, role: UserRole): Promise<void> {
    const { data, error: err } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();
    if (err) throw new Error(err.message);
    if (!data) {
      throw new Error('Role was not updated. You may lack permission, or the user no longer exists.');
    }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: data.role as UserRole } : p));
  }

  async function updateName(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const { data, error: err } = await supabase
      .rpc('update_profile_name', {
        target_profile_id: id,
        new_name: trimmed,
      })
      .single();
    if (err) throw new Error(err.message);
    if (!data) {
      throw new Error('Name was not saved. You may lack permission to edit this user.');
    }
    // Confirm persistence from DB to avoid false-positive "saved" states.
    const { data: verify, error: verifyErr } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', id)
      .single();
    if (verifyErr) throw new Error(`Saved, but verification failed: ${verifyErr.message}`);
    const savedName = (verify?.name ?? null) as string | null;
    if (savedName !== (trimmed || null)) {
      throw new Error('Name update did not persist. Check your profiles UPDATE RLS policies in Supabase.');
    }
    setProfiles(prev =>
      prev.map(p => (p.id === id ? { ...p, name: savedName } : p)),
    );
  }

  async function createUser(payload: CreateUserPayload): Promise<void> {
    let { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) throw new Error(`Authentication refresh failed: ${refreshErr.message}`);
      accessToken = refreshed.session?.access_token;
    }
    if (!accessToken) {
      throw new Error('Authentication session is missing. Please sign out and sign in again.');
    }

    const { error: fnErr } = await supabase.functions.invoke('admin-create-user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone ?? null,
        password: payload.password,
        role: payload.role,
        initialCustomerId: payload.initialCustomerId ?? null,
      },
    });
    if (fnErr) {
      // Surface edge-function error body when available.
      let msg = fnErr.message || 'Could not create user.';
      const res = (fnErr as { context?: Response }).context;
      if (res) {
        try {
          const json = await res.clone().json() as { error?: string; message?: string };
          msg = json.error ?? json.message ?? msg;
        } catch {
          try {
            const text = await res.clone().text();
            if (text) msg = text;
          } catch {
            // keep original fnErr message
          }
        }
      }
      throw new Error(msg);
    }

    await fetchProfiles();
  }

  async function setUserPassword(userId: string, newPassword: string): Promise<void> {
    const trimmed = newPassword.trim();
    if (trimmed.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    let { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) throw new Error(`Authentication refresh failed: ${refreshErr.message}`);
      accessToken = refreshed.session?.access_token;
    }
    if (!accessToken) {
      throw new Error('Authentication session is missing. Please sign out and sign in again.');
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-user-password`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, newPassword: trimmed }),
      },
    );
    const body = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) {
      throw new Error(body.error || `Password reset failed (HTTP ${res.status}).`);
    }
  }

  async function deleteProfile(id: string): Promise<void> {
    // Removes the profile row; the user's auth.users entry remains but the
    // app treats a missing profile as an unauthorised session and signs them out.
    const { error: err } = await supabase.from('profiles').delete().eq('id', id);
    if (err) throw new Error(err.message);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }

  // ── Customer assignments ────────────────────────────────────────────────────

  async function fetchAssignedCustomers(userId: string): Promise<string[]> {
    const { data, error: err } = await supabase
      .from('user_customers')
      .select('customer_id')
      .eq('user_id', userId);
    if (err) throw new Error(err.message);
    return (data ?? []).map((r: { customer_id: string }) => r.customer_id);
  }

  async function assignCustomer(userId: string, customerId: string): Promise<void> {
    const { error: err } = await supabase
      .from('user_customers')
      .insert({ user_id: userId, customer_id: customerId });
    if (err) throw new Error(err.message);
  }

  async function removeCustomerAssignment(userId: string, customerId: string): Promise<void> {
    const { error: err } = await supabase
      .from('user_customers')
      .delete()
      .eq('user_id', userId)
      .eq('customer_id', customerId);
    if (err) throw new Error(err.message);
  }

  async function setCustomerAssignments(userId: string, customerIds: string[]): Promise<void> {
    // Replace all assignments atomically: delete existing, then insert new set
    const { error: delErr } = await supabase
      .from('user_customers')
      .delete()
      .eq('user_id', userId);
    if (delErr) throw new Error(delErr.message);

    if (customerIds.length > 0) {
      const rows = customerIds.map(cid => ({ user_id: userId, customer_id: cid }));
      const { error: insErr } = await supabase.from('user_customers').insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
  }

  return {
    profiles,
    loading,
    error,
    fetchProfiles,
    updateRole,
    updateName,
    createUser,
    setUserPassword,
    deleteProfile,
    fetchAssignedCustomers,
    assignCustomer,
    removeCustomerAssignment,
    setCustomerAssignments,
  };
}
