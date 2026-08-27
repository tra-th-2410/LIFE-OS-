'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: UserRole | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  role: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function getStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const ref = url.replace(/^https?:\/\//, '').split('.')[0];
  return `sb-${ref}-auth-token`;
}

function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem(getStorageKey());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const resolvedRef = useRef(false);

  const loadProfile = useCallback(async (uid: string) => {
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile(p as Profile | null);

    const { data: r } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', uid)
      .maybeSingle();
    setRole((r?.role as UserRole) ?? 'user');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolvedRef.current = true;
        setSession(data.session);
        setUser(data.session.user ?? null);
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        // getSession returned null. If a session still exists in localStorage,
        // the token refresh failed transiently but auth-js did NOT remove the
        // session. Keep loading and retry — onAuthStateChange may also resolve it.
        // If the session was removed (non-retryable error), redirect is correct.
        if (hasStoredSession()) {
          setTimeout(async () => {
            if (resolvedRef.current) return;
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData?.session) {
              resolvedRef.current = true;
              setSession(retryData.session);
              setUser(retryData.session.user ?? null);
              loadProfile(retryData.session.user.id).finally(() => setLoading(false));
            } else if (!hasStoredSession()) {
              setSession(null);
              setUser(null);
              setLoading(false);
            } else {
              setSession(null);
              setUser(null);
              setLoading(false);
            }
          }, 2000);
        } else {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        resolvedRef.current = true;
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION' && !newSession) {
        if (!hasStoredSession()) {
          resolvedRef.current = true;
          setSession(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      resolvedRef.current = true;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    resolvedRef.current = true;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, role, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
