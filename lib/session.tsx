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

import { supabase } from './supabase';

/**
 * Identity is two independent things:
 *
 *   - a Supabase anonymous session, which is what RLS checks and what every
 *     row is keyed on;
 *   - a display name, which lives only on this device and gets copied onto
 *     each event the user hosts. There is no profiles table.
 */

const NAME_KEY = 'runit.displayName';

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 30;

export type SessionValue = {
  userId: string | null;
  displayName: string | null;
  loading: boolean;
  /** Set when anonymous sign-in failed, so the gate can say so out loud. */
  error: string | null;
  setDisplayName: (name: string) => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      const [{ data: sessionData }, storedName] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(NAME_KEY).catch(() => null),
      ]);
      if (cancelled) return;

      if (storedName && storedName.trim()) setName(storedName);

      // Already signed in from a previous launch: reuse that user id.
      let id = sessionData.session?.user.id ?? null;

      if (!id) {
        const { data, error: signInError } = await supabase.auth.signInAnonymously();
        if (cancelled) return;
        if (signInError) {
          setError(`Couldn't reach Supabase (${signInError.message})`);
        } else {
          id = data.user?.id ?? null;
        }
      }

      setUserId(id);
    }

    boot()
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Something went wrong');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Token refresh can hand back a different user; keep the id in step with it.
  // INITIAL_SESSION is skipped because boot() above already owns that read —
  // letting it through can clear a userId we just signed in.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const setDisplayName = useCallback(async (next: string) => {
    const trimmed = next.trim().slice(0, NAME_MAX_LENGTH);
    setName(trimmed);
    await AsyncStorage.setItem(NAME_KEY, trimmed);
  }, []);

  const value = useMemo(
    () => ({ userId, displayName, loading, error, setDisplayName }),
    [userId, displayName, loading, error, setDisplayName]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
