import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../lib/theme';
import { clockTime, startLabel } from '../lib/time';
import type { FeedEvent } from '../lib/types';

type Props = {
  event: FeedEvent;
  now: number;
  pending: boolean;
  onToggleJoin: () => void;
};

export function EventCard({ event, now, pending, onToggleJoin }: Props) {
  const when = startLabel(event.starts_at, now);
  const fill = Math.min(
    Math.max(event.joined_count / Math.max(event.wants, 1), 0),
    1
  );

  return (
    <View style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={[styles.when, when.urgent && styles.whenSoon]}>{when.text}</Text>
        <Text style={styles.clock}>{clockTime(event.starts_at)}</Text>
      </View>

      <Text style={styles.activity}>{event.title}</Text>

      <Text style={styles.meta} numberOfLines={1}>
        {event.place}
        <Text style={styles.metaDim}>{`  ·  ${event.host_name}`}</Text>
      </Text>

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
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={
            event.joined
              ? `Leave ${event.title}`
              : `Join ${event.title} at ${event.place}`
          }
          style={({ pressed }) => [
            styles.joinButton,
            event.joined && styles.joinButtonJoined,
            pressed && styles.joinButtonPressed,
            pending && styles.joinButtonPending,
          ]}
        >
          {pending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={[styles.joinLabel, event.joined && styles.joinLabelJoined]}>
              {event.joined ? "You're in" : 'Join'}
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
});
