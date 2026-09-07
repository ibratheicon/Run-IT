import { EVENT_VISIBLE_MINUTES_AFTER_START } from './config';

/**
 * Pure time formatting for the feed. Everything takes an explicit `now` in
 * milliseconds so the rules are unit-testable without faking a clock.
 */

const MINUTE_MS = 60 * 1000;

/** Under 15 minutes out, the time reads as urgent rather than informational. */
export const SOON_MINUTES = 15;

/**
 * Auto-expiry is a read filter, not a background job: an event drops off the
 * feed `EVENT_VISIBLE_MINUTES_AFTER_START` minutes after its start time. The
 * `live_events` view applies the same rule; this re-checks it locally so an
 * event disappears while the screen sits open.
 */
export function isLive(startsAt: string, now: number): boolean {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return false;
  return now < start + EVENT_VISIBLE_MINUTES_AFTER_START * MINUTE_MS;
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
