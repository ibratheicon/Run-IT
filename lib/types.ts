/**
 * Mirrors the two Supabase tables described in the PRD.
 *
 *   events (activity, location, start time, capacity wanted, host, created)
 *   joins  (event id, user id, timestamp)
 *
 * `joinCount` and `joinedByMe` are derived from `joins`, not stored on the row.
 */

export type User = {
  id: string;
  name: string;
};

export type Event = {
  id: string;
  activity: string;
  location: string;
  /** ISO 8601. */
  startsAt: string;
  /** How many people the host is looking for. Displayed, never enforced. */
  capacityWanted: number;
  hostId: string;
  hostName: string;
  /** ISO 8601. */
  createdAt: string;
  joinCount: number;
  joinedByMe: boolean;
};

export type NewEvent = {
  activity: string;
  location: string;
  startsAt: string;
  capacityWanted: number;
};
