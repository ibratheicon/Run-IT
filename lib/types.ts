/**
 * Row shapes for the Supabase schema. Defined once here and reused by the
 * data layer and the screens — nothing else re-describes a table.
 *
 *   events(id, host_id, host_name, title, place, description, starts_at,
 *          ends_at, wants, created_at)
 *   joins(event_id, user_id, user_name, created_at)
 *   live_events — view over both: unexpired events with joined_count folded in
 */

/** One row of the `live_events` view, exactly as the API returns it. */
export type LiveEventRow = {
  id: string;
  title: string;
  place: string;
  /** Free text the host can add. Null when they skipped it. Max 200 chars. */
  description: string | null;
  /** ISO 8601. */
  starts_at: string;
  /** ISO 8601. When the event stops being live — the whole expiry rule. */
  ends_at: string;
  /** How many people the host is looking for. Displayed, never enforced. */
  wants: number;
  host_id: string;
  host_name: string;
  joined_count: number;
};

/** The columns the client writes when hosting. The rest are defaulted. */
export type EventInsert = {
  host_id: string;
  host_name: string;
  title: string;
  place: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  wants: number;
};

/** Only the column the feed needs from `joins`. */
export type JoinRow = {
  event_id: string;
};

/** What the client writes when someone taps Join. */
export type JoinInsert = {
  event_id: string;
  user_id: string;
  user_name: string;
};

/** A view row plus whether the signed-in user is on it. What the UI renders. */
export type FeedEvent = LiveEventRow & {
  joined: boolean;
};

/** One line of the "who's in" list: a `joins` row, minus the event it's on. */
export type RosterRow = {
  user_id: string;
  user_name: string;
  /** ISO 8601. The list is ordered by it, so the host's row comes first. */
  created_at: string;
};

/**
 * The single event the signed-in user is on, and which side of it they're on.
 * The one-live-event rule is what makes this a single value and not a list.
 */
export type MineEvent = {
  event: FeedEvent;
  role: 'host' | 'guest';
};
