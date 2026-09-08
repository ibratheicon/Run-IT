import { supabase } from './supabase';
import type {
  EventInsert,
  FeedEvent,
  JoinInsert,
  JoinRow,
  LiveEventRow,
  MineEvent,
  RosterRow,
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

/** Every column of the `live_events` view that the app renders. */
const EVENT_COLUMNS =
  'id, title, place, description, starts_at, ends_at, wants, host_id, host_name, joined_count';

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
      .select(EVENT_COLUMNS)
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

/**
 * The one event this user is on, hosted or joined, or null. Hosting wins if
 * both somehow exist. A join pointing at an event that has already expired
 * reads as nothing, since the view no longer returns it.
 */
export async function fetchMine(userId: string): Promise<MineEvent | null> {
  const hosted = await supabase
    .from('live_events')
    .select(EVENT_COLUMNS)
    .eq('host_id', userId)
    .limit(1)
    .returns<LiveEventRow[]>();

  if (hosted.error) fail("Couldn't load your event", hosted.error);

  const hostedRow = hosted.data?.[0];
  if (hostedRow) return { event: { ...hostedRow, joined: true }, role: 'host' };

  const join = await supabase
    .from('joins')
    .select('event_id')
    .eq('user_id', userId)
    .limit(1)
    .returns<JoinRow[]>();

  if (join.error) fail("Couldn't load your event", join.error);

  const eventId = join.data?.[0]?.event_id;
  if (!eventId) return null;

  const joined = await supabase
    .from('live_events')
    .select(EVENT_COLUMNS)
    .eq('id', eventId)
    .limit(1)
    .returns<LiveEventRow[]>();

  if (joined.error) fail("Couldn't load your event", joined.error);

  const joinedRow = joined.data?.[0];
  if (!joinedRow) return null;

  return { event: { ...joinedRow, joined: true }, role: 'guest' };
}

/** Who's on an event, oldest join first — which puts the host at the top. */
export async function fetchRoster(eventId: string): Promise<RosterRow[]> {
  const { data, error } = await supabase
    .from('joins')
    .select('user_id, user_name, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .returns<RosterRow[]>();

  if (error) fail("Couldn't load who's in", error);

  return data ?? [];
}

/** Cancelling. RLS allows this only for your own event; joins cascade. */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);

  if (error) fail("Couldn't cancel that", error);
}

export async function leaveEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('joins')
    .delete()
    .match({ event_id: eventId, user_id: userId });

  if (error) fail("Couldn't leave that", error);
}
