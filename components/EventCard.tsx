import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';
import { clockTime, isGreyed, startLabel } from '../lib/time';
import type { FeedEvent } from '../lib/types';

type Props = {
  event: FeedEvent;
  now: number;
  pending: boolean;
  /** The user is live on a different event, so this one can't be joined yet. */
  blocked: boolean;
  onToggleJoin: () => void;
};

export function EventCard({ event, now, pending, blocked, onToggleJoin }: Props) {
  const when = startLabel(event.starts_at, now);
  // Long since started: dimmed, but every control still works.
  const greyed = isGreyed(event.starts_at, now);
  const fill = Math.min(
    Math.max(event.joined_count / Math.max(event.wants, 1), 0),
    1
  );

  return (
    <View style={[styles.card, greyed && styles.cardGreyed]}>
      <View style={styles.timeRow}>
        <Text style={[styles.when, when.urgent && styles.whenSoon]}>{when.text}</Text>
        <Text style={styles.clock}>
          {`${clockTime(event.starts_at)} – ${clockTime(event.ends_at)}`}
        </Text>
      </View>

      <Text style={styles.activity}>{event.title}</Text>

      <Text style={styles.meta} numberOfLines={1}>
        {event.place}
        <Text style={styles.metaDim}>{`  ·  ${event.host_name}`}</Text>
      </Text>

      {event.description?.trim() ? (
        <Text style={styles.description} numberOfLines={2}>
          {event.description.trim()}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.countBlock}>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${fill * 100}%` },
                event.joined && styles.trackFillJoined,
              ]}
            />
          </View>
          <Text style={styles.count}>
            {event.joined_count} in
            <Text style={styles.metaDim}>{`  ·  wants ${event.wants}`}</Text>
          </Text>
        </View>

        <Pressable
          onPress={onToggleJoin}
          disabled={pending || blocked}
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          accessibilityLabel={
            blocked
              ? `Can't join ${event.title} — you're already in another event`
              : event.joined
                ? `Leave ${event.title}`
                : `Join ${event.title} at ${event.place}`
          }
          style={({ pressed }) => [
            styles.joinButton,
            event.joined && styles.joinButtonJoined,
            blocked && styles.joinButtonBlocked,
            pressed && !blocked && styles.joinButtonPressed,
            pending && styles.joinButtonPending,
          ]}
        >
          {pending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text
              numberOfLines={1}
              style={[
                styles.joinLabel,
                event.joined && styles.joinLabelJoined,
                blocked && styles.joinLabelBlocked,
              ]}
            >
              {blocked ? 'In another event' : event.joined ? "You're in" : 'Join'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardGreyed: {
    opacity: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  when: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  whenSoon: {
    color: colors.accent,
  },
  clock: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: '500',
  },
  activity: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
  },
  meta: {
    color: colors.muted,
    fontSize: 15,
  },
  metaDim: {
    color: colors.faint,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  countBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  trackFillJoined: {
    backgroundColor: colors.joined,
  },
  count: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    minWidth: 92,
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonJoined: {
    backgroundColor: colors.joinedDim,
    borderWidth: 1,
    borderColor: colors.joined,
  },
  joinButtonBlocked: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  joinButtonPressed: {
    opacity: 0.75,
  },
  joinButtonPending: {
    opacity: 0.6,
  },
  joinLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  joinLabelJoined: {
    color: colors.joined,
  },
  joinLabelBlocked: {
    color: colors.muted,
    fontWeight: '600',
  },
});
