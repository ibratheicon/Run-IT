import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../components/EventCard';
import { joinEvent, leaveEvent, listLiveEvents } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';
import { isLive } from '../lib/time';
import type { Event } from '../lib/types';
import { useNow } from '../lib/useNow';

export default function Feed() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const now = useNow();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await listLiveEvents());
    } catch {
      Alert.alert("Couldn't load the feed", 'Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the feed comes back into view, including after hosting.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /**
   * The server already applied the expiry filter, but the clock keeps moving
   * while the screen is open — re-filter locally so stale events disappear.
   */
  const live = useMemo(
    () => events.filter((event) => isLive(event.startsAt, now)),
    [events, now]
  );

  const toggleJoin = useCallback(async (event: Event) => {
    setPendingId(event.id);
    try {
      const updated = event.joinedByMe
        ? await leaveEvent(event.id)
        : await joinEvent(event.id);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch {
      Alert.alert("That didn't go through", 'Try again in a second.');
    } finally {
      setPendingId(null);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.wordmark}>RunIt</Text>
          <Text style={styles.subtitle}>
            Otero &amp; Wilbur
            <Text style={styles.subtitleDim}>
              {loading ? '' : `  ·  ${live.length} live`}
            </Text>
          </Text>
        </View>

        <Pressable
          onPress={() =>
            Alert.alert(user?.name ?? 'You', 'Switch to a different name?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Your account"
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(user?.name ?? '?').charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={live}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            live.length === 0 && styles.listEmpty,
          ]}
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
              isHost={item.hostId === user?.id}
              pending={pendingId === item.id}
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
      <Text style={styles.emptyTitle}>Nothing running right now</Text>
      <Text style={styles.emptyBody}>
        Somebody has to go first. Four fields, ten seconds, and whoever&apos;s
        free will see it.
      </Text>
      <Pressable
        onPress={onHost}
        accessibilityRole="button"
        style={({ pressed }) => [styles.emptyCta, pressed && styles.fabPressed]}
      >
        <Text style={styles.emptyCtaLabel}>Start something</Text>
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
  subtitleDim: {
    color: colors.faint,
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
