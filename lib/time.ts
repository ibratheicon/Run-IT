/**
 * Pure time formatting for the feed. Everything takes an explicit `now` in
 * milliseconds so the rules are unit-testable without faking a clock.
 */

const MINUTE_MS = 60 * 1000;

/** Under 15 minutes out, the time reads as urgent rather than informational. */
export const SOON_MINUTES = 15;

/**
 * Auto-expiry is a read filter, not a background job: an event drops off the
 * feed once its own `ends_at` passes. The `live_events` view applies the same
 * rule; this re-checks it locally so an event disappears while the screen
 * sits open.
 */
export function isLive(endsAt: string, now: number): boolean {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return false;
  return now < end;
}

/**
 * Whole minutes between now and the start. Past times round down and future
 * times round up, so the label never reads "IN 0 MIN" or "STARTED 0 MIN AGO".
 */
export function minutesUntil(startsAt: string, now: number): number {
  const diff = new Date(startsAt).getTime() - now;
  return diff >= 0 ? Math.ceil(diff / MINUTE_MS) : Math.floor(diff / MINUTE_MS);
}

export type StartLabel = {
  /** "STARTED 10 MIN AGO", "IN 1 HR 5 MIN", "STARTING NOW". */
  text: string;
  /** Already started, or starting within the next 15 minutes. */
  urgent: boolean;
};

/**
 * The relative-time label. Anything in the past or inside the next quarter
 * hour is urgent, which the card renders in red; everything else is muted.
 */
export function startLabel(startsAt: string, now: number): StartLabel {
  const minutes = minutesUntil(startsAt, now);

  if (minutes < 0) {
    return { text: `STARTED ${Math.abs(minutes)} MIN AGO`, urgent: true };
  }
  if (minutes === 0) {
    return { text: 'STARTING NOW', urgent: true };
  }
  return { text: `IN ${durationText(minutes)}`, urgent: minutes <= SOON_MINUTES };
}

/** "45 MIN" / "1 HR" / "1 HR 5 MIN" */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} MIN`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} HR` : `${hours} HR ${rest} MIN`;
}

/** "10:28 PM" */
export function clockTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * MINUTE_MS).toISOString();
}

/** The bounds a hand-typed length has to land inside. */
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 360;

/**
 * "9:45 PM", "9:45pm", "9 pm", "21:45". Minutes are optional only when an
 * am/pm is present — a bare "9" could mean either end of the day, so it is
 * rejected rather than guessed at.
 */
const TIME_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i;

/**
 * Parses a typed clock time into an absolute epoch ms, or null if it isn't a
 * time. A time that has already gone by today is read as tomorrow's, which is
 * what someone typing "1:00 AM" at midnight means.
 */
export function parseTimeOfDay(input: string, now: number): number | null {
  const match = TIME_PATTERN.exec(input.trim());
  if (!match) return null;

  const [, rawHour, rawMinute, rawMeridiem] = match;
  const minute = rawMinute === undefined ? 0 : Number(rawMinute);
  let hour = Number(rawHour);

  if (minute > 59) return null;

  if (rawMeridiem) {
    if (hour < 1 || hour > 12) return null;
    const pm = rawMeridiem.replace(/\./g, '').toLowerCase() === 'pm';
    hour = (hour % 12) + (pm ? 12 : 0);
  } else if (rawMinute === undefined || hour > 23) {
    return null;
  }

  const at = new Date(now);
  at.setHours(hour, minute, 0, 0);

  // Compare against the top of the current minute so typing the time it is
  // right now doesn't jump a day.
  if (at.getTime() < Math.floor(now / MINUTE_MS) * MINUTE_MS) {
    // setDate rather than +24h: it stays correct across a DST change.
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
}

/** Parses a typed length in minutes, or null outside 15–360. */
export function parseDurationMinutes(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,3}$/.test(text)) return null;

  const minutes = Number(text);
  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) return null;
  return minutes;
}
