/**
 * Row shapes for the Supabase schema. Defined once here and reused by the
 * data layer and the screens — nothing else re-describes a table.
 *
 *   events(id, host_id, host_name, title, place, starts_at, wants, created_at)
 *   joins(event_id, user_id, created_at)
 *   live_events — view over both: unexpired events with joined_count folded in
 */

/** One row of the `live_events` view, exactly as the API returns it. */
export type LiveEventRow = {
  id: string;
  title: string;
  place: string;
  /** ISO 8601. */
  starts_at: string;
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
  starts_at: string;
  wants: number;
};

/** Only the column the feed needs from `joins`. */
export type JoinRow = {
  event_id: string;
};

/** A view row plus whether the signed-in user is on it. What the UI renders. */
export type FeedEvent = LiveEventRow & {
  joined: boolean;
};
