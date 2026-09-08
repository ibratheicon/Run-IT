import { supabase } from './supabase';
import type {
  EventInsert,
  FeedEvent,
  JoinInsert,
  JoinRow,
  LiveEventRow,
} from './types';

/**
 * The whole data layer. Every screen talks to this module and nothing else.
 *
 * Expiry, ordering and `joined_count` all live in the `live_events` view, so
 * the feed is one select plus one small select for "which of these am I on".
 */

/**
 * The database allows one live event per person — hosting or joining a second
 * one raises `ONE_LIVE_EVENT`. It is thrown on as a type so screens can word
 * the rule themselves; the raw code never reaches the UI.
 */
export class AlreadyInLiveEventError extends Error {
  constructor() {
    super('Already in a live event');
    this.name = 'AlreadyInLiveEventError';
  }
}

/** Where the raised message can land depends on how PostgREST reports it. */
type QueryError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function isOneLiveEvent(error: QueryError): boolean {
  return [error.message, error.details, error.hint].some((text) =>
    text?.includes('ONE_LIVE_EVENT')
  );
}

/** Turns a PostgREST failure into something short enough to show on screen. */
function fail(what: string, error: QueryError): never {
  if (isOneLiveEvent(error)) throw new AlreadyInLiveEventError();
  throw new Error(`${what} (${error.message})`);
}

/**
 * The feed: every unexpired event, plus whether this user has joined it.
 * Two queries rather than an embedded join so the view keeps doing the
 * counting — the second one only returns the current user's rows.
 */
export async function fetchFeed(userId: string): Promise<FeedEvent[]> {
  const [events, joins] = await Promise.all([
    supabase
      .from('live_events')
      .select(
        'id, title, place, description, starts_at, ends_at, wants, host_id, host_name, joined_count'
      )
      .returns<LiveEventRow[]>(),
    supabase
      .from('joins')
      .select('event_id')
      .eq('user_id', userId)
      .returns<JoinRow[]>(),
  ]);

  if (events.error) fail("Couldn't load the feed", events.error);
  if (joins.error) fail("Couldn't load your joins", joins.error);

  const mine = new Set((joins.data ?? []).map((row) => row.event_id));

  // The view already sorts by starts_at ascending; keep that order as-is.
  return (events.data ?? []).map((row) => ({ ...row, joined: mine.has(row.id) }));
}

/**
 * A database trigger adds the host's own `joins` row, so this inserts the
 * event and nothing else — inserting the join here would hit the composite
 * primary key.
 */
export async function createEvent(input: EventInsert): Promise<LiveEventRow> {
  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select(
      'id, title, place, description, starts_at, ends_at, wants, host_id, host_name'
    )
    .single();

  if (error) fail("Couldn't post that", error);

  const row = data as Omit<LiveEventRow, 'joined_count'>;
  return { ...row, joined_count: 1 };
}

/**
 * No capacity enforcement — the count is a target, which is what lets this be
 * a plain insert instead of a concurrency-safe transaction. A duplicate key
 * means someone double-tapped; that is already the state we wanted.
 *
 * `user_name` is denormalized onto the row the same way `host_name` is on
 * events, so a roster never needs a profiles join.
 */
export async function joinEvent(
  eventId: string,
  userId: string,
  userName: string
): Promise<void> {
  const row: JoinInsert = {
    event_id: eventId,
    user_id: userId,
    user_name: userName,
  };
  const { error } = await supabase.from('joins').insert(row);

  if (error && error.code !== '23505') fail("Couldn't join that", error);
}

export async function leaveEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('joins')
    .delete()
    .match({ event_id: eventId, user_id: userId });

  if (error) fail("Couldn't leave that", error);
}
