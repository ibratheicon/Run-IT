import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';
import { clockTime, relativeStart } from '../lib/time';
import type { Event } from '../lib/types';

type Props = {
  event: Event;
  now: number;
  isHost: boolean;
  pending: boolean;
  onToggleJoin: () => void;
};

/** Under 15 minutes out, the time reads as urgent rather than informational. */
const SOON_MS = 15 * 60 * 1000;

export function EventCard({ event, now, isHost, pending, onToggleJoin }: Props) {
  const soon = new Date(event.startsAt).getTime() - now < SOON_MS;
  const fill = Math.min(event.joinCount / Math.max(event.capacityWanted, 1), 1);

  return (
    <View style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={[styles.when, soon && styles.whenSoon]}>
          {relativeStart(event.startsAt, now)}
        </Text>
        <Text style={styles.clock}>{clockTime(event.startsAt)}</Text>
      </View>

      <Text style={styles.activity}>{event.activity}</Text>

      <Text style={styles.meta} numberOfLines={1}>
        {event.location}
        <Text style={styles.metaDim}>{isHost ? '  ·  you' : `  ·  ${event.hostName}`}</Text>
      </Text>

      <View style={styles.footer}>
        <View style={styles.countBlock}>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${fill * 100}%` },
                event.joinedByMe && styles.trackFillJoined,
              ]}
            />
          </View>
          <Text style={styles.count}>
            {event.joinCount} in
            <Text style={styles.metaDim}>{`  ·  wants ${event.capacityWanted}`}</Text>
          </Text>
        </View>

        {isHost ? (
          <View style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>Hosting</Text>
          </View>
        ) : (
          <Pressable
            onPress={onToggleJoin}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={
              event.joinedByMe
                ? `Leave ${event.activity}`
                : `Join ${event.activity} at ${event.location}`
            }
            style={({ pressed }) => [
              styles.joinButton,
              event.joinedByMe && styles.joinButtonJoined,
              pressed && styles.joinButtonPressed,
              pending && styles.joinButtonPending,
            ]}
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text
                style={[styles.joinLabel, event.joinedByMe && styles.joinLabelJoined]}
              >
                {event.joinedByMe ? "You're in" : 'Join'}
              </Text>
            )}
          </Pressable>
        )}
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  hostBadge: {
    height: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBadgeText: {
    color: colors.faint,
    fontSize: 14,
    fontWeight: '600',
  },
});
