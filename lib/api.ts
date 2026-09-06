import { isLive, minutesFromNow } from './time';
import type { Event, NewEvent, User } from './types';

/**
 * The whole data layer. Every screen talks to this module and nothing else,
 * so replacing the in-memory store with Supabase is a change to this file
 * alone — see `SUPABASE.md` for the queries that go in each function.
 */

// --- in-memory stand-in for the two tables ---------------------------------

type EventRow = Omit<Event, 'joinCount' | 'joinedByMe'>;
type JoinRow = { eventId: string; userId: string; createdAt: string };

let currentUser: User | null = null;

/** Called by the session provider so joins can be attributed. */
export function setCurrentUser(user: User | null): void {
  currentUser = user;
}

let nextId = 100;
function newEventId(): string {
  nextId += 1;
  return `e_${nextId}`;
}

const events: EventRow[] = [
  {
    id: 'e_1',
    activity: 'Boba run to Sharetea',
    location: 'Otero lobby',
    startsAt: minutesFromNow(12),
    capacityWanted: 4,
    hostId: 'u_seed_maya',
    hostName: 'Maya',
    createdAt: minutesFromNow(-25),
  },
  {
    id: 'e_2',
    activity: 'Pickup basketball',
    location: 'Wilbur courts',
    startsAt: minutesFromNow(35),
    capacityWanted: 8,
    hostId: 'u_seed_deon',
    hostName: 'Deon',
    createdAt: minutesFromNow(-40),
  },
  {
    id: 'e_3',
    activity: 'Dinner at Wilbur, whoever',
    location: 'Wilbur dining, by the door',
    startsAt: minutesFromNow(-8),
    capacityWanted: 6,
    hostId: 'u_seed_priya',
    hostName: 'Priya',
    createdAt: minutesFromNow(-55),
  },
  {
    id: 'e_4',
    activity: 'CS 106A problem set grind',
    location: 'Otero 2nd floor lounge',
    startsAt: minutesFromNow(75),
    capacityWanted: 3,
    hostId: 'u_seed_sam',
    hostName: 'Sam',
    createdAt: minutesFromNow(-15),
  },
  {
    id: 'e_5',
    activity: 'Walk to the Dish before it gets dark',
    location: 'Meet at Otero bike racks',
    startsAt: minutesFromNow(50),
    capacityWanted: 5,
    hostId: 'u_seed_alex',
    hostName: 'Alex',
    createdAt: minutesFromNow(-6),
  },
  // Already past the 30-minute grace window — proves the expiry filter works.
  {
    id: 'e_6',
    activity: 'Late night Coupa',
    location: 'Coupa Cafe',
    startsAt: minutesFromNow(-95),
    capacityWanted: 4,
    hostId: 'u_seed_maya',
    hostName: 'Maya',
    createdAt: minutesFromNow(-160),
  },
];

const joins: JoinRow[] = [
  { eventId: 'e_1', userId: 'u_seed_deon', createdAt: minutesFromNow(-20) },
  { eventId: 'e_1', userId: 'u_seed_sam', createdAt: minutesFromNow(-18) },
  { eventId: 'e_2', userId: 'u_seed_maya', createdAt: minutesFromNow(-30) },
  { eventId: 'e_2', userId: 'u_seed_priya', createdAt: minutesFromNow(-28) },
  { eventId: 'e_2', userId: 'u_seed_alex', createdAt: minutesFromNow(-22) },
  { eventId: 'e_2', userId: 'u_seed_sam', createdAt: minutesFromNow(-11) },
  { eventId: 'e_3', userId: 'u_seed_alex', createdAt: minutesFromNow(-45) },
  { eventId: 'e_5', userId: 'u_seed_priya', createdAt: minutesFromNow(-4) },
];

// --- helpers ---------------------------------------------------------------

/** Stands in for network time so the UI's loading states are real. */
function latency<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function hydrate(row: EventRow): Event {
  const forEvent = joins.filter((j) => j.eventId === row.id);
  return {
    ...row,
    joinCount: forEvent.length,
    joinedByMe: currentUser ? forEvent.some((j) => j.userId === currentUser!.id) : false,
  };
}

// --- the API ---------------------------------------------------------------

/**
 * The feed. Expiry is a read filter rather than a background job, so an event
 * simply stops being returned 30 minutes after it was meant to start.
 */
export async function listLiveEvents(): Promise<Event[]> {
  const now = Date.now();
  if (process.env.EXPO_PUBLIC_FORCE_EMPTY_FEED === '1') return latency([]);
  const live = events
    .filter((row) => isLive(row.startsAt, now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map(hydrate);

  return latency(live);
}

export async function createEvent(input: NewEvent): Promise<Event> {
  if (!currentUser) throw new Error('Not signed in');

  const row: EventRow = {
    id: newEventId(),
    activity: input.activity.trim(),
    location: input.location.trim(),
    startsAt: input.startsAt,
    capacityWanted: input.capacityWanted,
    hostId: currentUser.id,
    hostName: currentUser.name,
    createdAt: new Date().toISOString(),
  };

  events.push(row);
  // Hosting is an implicit join: the host is one of the people who'll be there.
  joins.push({ eventId: row.id, userId: currentUser.id, createdAt: row.createdAt });

  return latency(hydrate(row));
}

/**
 * No hard capacity enforcement — the count is informational, which is what
 * lets this be a plain insert instead of a concurrency-safe transaction.
 */
export async function joinEvent(eventId: string): Promise<Event> {
  if (!currentUser) throw new Error('Not signed in');

  const row = events.find((e) => e.id === eventId);
  if (!row) throw new Error('Event not found');

  const already = joins.some((j) => j.eventId === eventId && j.userId === currentUser!.id);
  if (!already) {
    joins.push({ eventId, userId: currentUser.id, createdAt: new Date().toISOString() });
  }

  return latency(hydrate(row));
}

export async function leaveEvent(eventId: string): Promise<Event> {
  if (!currentUser) throw new Error('Not signed in');

  const row = events.find((e) => e.id === eventId);
  if (!row) throw new Error('Event not found');

  const index = joins.findIndex(
    (j) => j.eventId === eventId && j.userId === currentUser!.id
  );
  if (index !== -1) joins.splice(index, 1);

  return latency(hydrate(row));
}
