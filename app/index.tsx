import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../components/EventCard';
import {
  AlreadyInLiveEventError,
  fetchFeed,
  joinEvent,
  leaveEvent,
} from '../lib/api';
import { nameInitial, useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';
import { isLive } from '../lib/time';
import type { FeedEvent } from '../lib/types';
import { useNow } from '../lib/useNow';

/** How often the feed refetches on its own, so the other person's taps show up. */
const POLL_MS = 20000;

/** The one-live-event rule, worded for the person who just tapped Join. */
const ALREADY_LIVE_MESSAGE =
  "You're already in a live event. Leave it first to join this one.";

function message(cause: unknown): string {
  if (cause instanceof AlreadyInLiveEventError) return ALREADY_LIVE_MESSAGE;
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export default function Feed() {
  const router = useRouter();
  const { userId, displayName } = useSession();
  const now = useNow();

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  /**
   * Events with a join/leave in flight. A background refetch must not stomp
   * the optimistic state of a card the user just tapped.
   */
  const pending = useRef<Set<string>>(new Set());

  const markPending = useCallback((id: string, on: boolean) => {
    if (on) pending.current.add(id);
    else pending.current.delete(id);
    setPendingIds([...pending.current]);
  }, []);

  const applyRows = useCallback((rows: FeedEvent[]) => {
    setEvents((prev) => {
      if (pending.current.size === 0) return rows;
      const byId = new Map(prev.map((event) => [event.id, event]));
      return rows.map((row) => {
        const local = pending.current.has(row.id) ? byId.get(row.id) : undefined;
        return local
          ? { ...row, joined: local.joined, joined_count: local.joined_count }
          : row;
      });
    });
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      applyRows(await fetchFeed(userId));
      setError(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [userId, applyRows]);

  // Refetch whenever the feed comes back into view, including after hosting.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * The view already applied the expiry filter, but the clock keeps moving
   * while the screen is open — re-filter locally so stale events disappear.
   */
  const live = useMemo(
    () => events.filter((event) => isLive(event.ends_at, now)),
    [events, now]
  );

  // One live event per person: while they're on one, every other card's Join
  // is inert rather than a tap that the database would reject.
  const inAnEvent = useMemo(() => live.some((event) => event.joined), [live]);

  const toggleJoin = useCallback(
    async (event: FeedEvent) => {
      if (!userId || pending.current.has(event.id)) return;
      const joining = !event.joined;

      markPending(event.id, true);
      // Optimistic: the tap lands now, the server reconciles a moment later.
      setEvents((prev) =>
        prev.map((row) =>
          row.id === event.id
            ? {
                ...row,
                joined: joining,
                joined_count: Math.max(0, row.joined_count + (joining ? 1 : -1)),
              }
            : row
        )
      );

      try {
        if (joining) await joinEvent(event.id, userId, displayName ?? 'Someone');
        else await leaveEvent(event.id, userId);
        setError(null);
      } catch (cause) {
        setEvents((prev) =>
          prev.map((row) => (row.id === event.id ? { ...row, ...event } : row))
        );
        setError(message(cause));
      } finally {
        markPending(event.id, false);
        void load();
      }
    },
    [userId, displayName, markPending, load]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.wordmark}>RunIt</Text>
          <Text style={styles.subtitle}>{loading ? ' ' : `${live.length} live`}</Text>
        </View>

        <Pressable
          onPress={() => router.push('/mine')}
          accessibilityRole="button"
          accessibilityLabel={`Your event — signed in as ${displayName ?? 'you'}`}
          style={({ pressed }) => [styles.avatar, pressed && styles.fabPressed]}
        >
          <Text style={styles.avatarText}>{nameInitial(displayName)}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={live}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, live.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.muted}
            />
          }
          ListEmptyComponent={<EmptyFeed onHost={() => router.push('/host')} />}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              now={now}
              pending={pendingIds.includes(item.id)}
              blocked={inAnEvent && !item.joined}
              onToggleJoin={() => void toggleJoin(item)}
            />
          )}
        />
      )}

      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => router.push('/host')}
          accessibilityRole="button"
          accessibilityLabel="Host something"
          style={({ pressed }) => [styles.hostButton, pressed && styles.fabPressed]}
        >
          <Text style={styles.hostButtonLabel}>Host something</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * The empty feed is the product's main failure mode, so it asks for a post
 * instead of apologizing.
 */
function EmptyFeed({ onHost }: { onHost: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing happening right now</Text>
      <Text style={styles.emptyBody}>
        Somebody has to go first. A few fields, ten seconds, and
        whoever&apos;s free will see it.
      </Text>
      <Pressable
        onPress={onHost}
        accessibilityRole="button"
        style={({ pressed }) => [styles.emptyCta, pressed && styles.fabPressed]}
      >
        <Text style={styles.emptyCtaLabel}>Host something</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: {
    gap: 2,
  },
  wordmark: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  bannerText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  emptyCtaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  hostButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  fabPressed: {
    opacity: 0.82,
  },
  hostButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
