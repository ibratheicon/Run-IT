/**
 * How long an event stays on the feed after its start time.
 *
 * The feed reads from the `live_events` view, which applies this same window
 * server-side. If you change this number you must also change the
 * `interval '30 minutes'` in the SQL definition of `live_events` to match —
 * otherwise the client and the view disagree about what "live" means.
 */
export const EVENT_VISIBLE_MINUTES_AFTER_START = 30;
