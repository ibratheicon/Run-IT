/**
 * Auto-expiry is a read filter, not a background job: an event drops off the
 * feed 30 minutes after its start time.
 */
export const EXPIRY_GRACE_MS = 30 * 60 * 1000;

export function isLive(startsAt: string, now: number): boolean {
  return now < new Date(startsAt).getTime() + EXPIRY_GRACE_MS;
}

/** "in 20 min" / "in 1h 15m" / "starting now" / "started 10 min ago" */
export function relativeStart(startsAt: string, now: number): string {
  const diffMin = Math.round((new Date(startsAt).getTime() - now) / 60000);

  if (diffMin <= -1) return `started ${Math.abs(diffMin)} min ago`;
  if (diffMin <= 1) return 'starting now';
  if (diffMin < 60) return `in ${diffMin} min`;

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins === 0 ? `in ${hours}h` : `in ${hours}h ${mins}m`;
}

/** "8:30 PM" */
export function clockTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60000).toISOString();
}
