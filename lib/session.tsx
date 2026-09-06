import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setCurrentUser } from './api';
import type { User } from './types';

/**
 * v1 auth is lightweight name entry, not email magic links — there is no
 * email provider in the loop and nothing to rate limit. The device holds an
 * anonymous id plus a display name.
 *
 * Swapping in Supabase anonymous auth later means replacing the id generated
 * here with the one from `supabase.auth.signInAnonymously()` and keeping the
 * name in `user_metadata`.
 */

const STORAGE_KEY = 'runit.session.v1';

type SessionValue = {
  user: User | null;
  loading: boolean;
  signIn: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function newId(): string {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as User;
          setUser(parsed);
          setCurrentUser(parsed);
        }
      })
      .catch(() => {
        // A corrupt or unreadable session just means we ask for a name again.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (name: string) => {
    const next: User = { id: newId(), name: name.trim() };
    setUser(next);
    setCurrentUser(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setCurrentUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
