import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'superadmin' | 'admin' | 'technician' | 'viewer';

export interface Profile {
  id:         string;
  email:      string;
  name:       string | null;
  role:       UserRole;
  created_at: string;
}

interface AuthContextValue {
  user:    User | null;
  profile: Profile | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();  // maybeSingle: returns null (no error) when 0 rows

    setProfile(data ? (data as Profile) : null);
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe,
    // which covers the same case as getSession() — so we don't need both.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      const previousUserId = currentUserIdRef.current;
      const nextUserId = u?.id ?? null;
      currentUserIdRef.current = nextUserId;
      setUser(u);

      if (!u) {
        setProfile(null);
        initializedRef.current = true;
        setLoading(false);
        return;
      }

      // Only block the full app on first session bootstrap or account switch.
      // Refocus / token refresh events should not unmount active pages/forms.
      const shouldBlockUi =
        !initializedRef.current || event === 'INITIAL_SESSION' || previousUserId !== nextUserId;
      if (shouldBlockUi) setLoading(true);

      void loadProfile(u.id)
        .finally(() => {
          initializedRef.current = true;
          if (shouldBlockUi) setLoading(false);
        });
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
