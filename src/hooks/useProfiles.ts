import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../context/AuthContext';

/** A temporary Supabase client with no session persistence — used for
 *  creating new users without overwriting the admin's current session. */
function makeEphemeralClient() {
  const noopStorage = {
    getItem:    () => null,
    setItem:    () => undefined,
    removeItem: () => undefined,
  };
  return createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { storage: noopStorage, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

export interface CreateUserPayload {
  name:     string;
  email:    string;
  password: string;
  role:     UserRole;
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
    const { error: err } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id);
    if (err) throw new Error(err.message);
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p));
  }

  async function updateName(id: string, name: string): Promise<void> {
    const { error: err } = await supabase
      .from('profiles')
      .update({ name: name.trim() || null })
      .eq('id', id);
    if (err) throw new Error(err.message);
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() || null } : p));
  }

  async function createUser(payload: CreateUserPayload): Promise<void> {
    const client = makeEphemeralClient();
    const { data, error: signUpErr } = await client.auth.signUp({
      email:    payload.email,
      password: payload.password,
      options: {
        data: { name: payload.name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (signUpErr) throw new Error(signUpErr.message);

    // data.user is null when signups are disabled or the email is already registered
    if (!data.user) {
      throw new Error(
        'Account creation failed. Check that "Enable sign ups" is on in your Supabase Auth settings, ' +
        'or that this email is not already registered.',
      );
    }

    // Upsert (not update) so the profile row is created immediately even if
    // the handle_new_user trigger hasn't committed yet.
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        { id: data.user.id, email: payload.email, name: payload.name, role: payload.role },
        { onConflict: 'id' },
      );
    if (upsertErr) throw new Error(upsertErr.message);

    await fetchProfiles();
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
    deleteProfile,
    fetchAssignedCustomers,
    assignCustomer,
    removeCustomerAssignment,
    setCustomerAssignments,
  };
}
