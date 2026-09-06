import { useEffect, useState } from 'react';

/**
 * A clock that re-renders on an interval, so "in 12 min" counts down and
 * expired events fall out of the feed without the user pulling to refresh.
 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
