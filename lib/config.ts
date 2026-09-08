/**
 * How long after its start time an event goes grey on the feed.
 *
 * Purely cosmetic: a greyed card is still live and still joinable — it has
 * just been going long enough that whoever is turning up has turned up. The
 * card stops being rendered at all when `ends_at` passes, which is the
 * database's rule, not this one.
 */
export const GREY_AFTER_START_MINUTES = 30;
